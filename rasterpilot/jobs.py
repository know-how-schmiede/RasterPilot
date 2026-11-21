"""Begrenzte SQLite-Warteschlange mit privaten temporären Bilddateien."""

from contextlib import contextmanager
import os
from pathlib import Path
import secrets
import re
import sqlite3
import shutil
import time


class QueueFull(ValueError):
    pass


class JobStore:
    @classmethod
    def configured(cls, root):
        def setting(key, default, maximum, minimum=1):
            try:
                value = int(os.environ.get(key, default))
            except ValueError as error:
                raise ValueError(f'{key} muss eine ganze Zahl sein.') from error
            if not minimum <= value <= maximum:
                raise ValueError(f'{key} muss zwischen {minimum} und {maximum} liegen.')
            return value
        return cls(root, ttl=setting('RASTERPILOT_JOB_TTL', 3600, 86400, 60),
                   capacity=setting('RASTERPILOT_QUEUE_LIMIT', 10, 10),
                   retained=setting('RASTERPILOT_RETAINED_JOBS', 20, 20),
                   quota=setting('RASTERPILOT_STORAGE_MIB', 1024, 1024, 32) * 1024 ** 2)

    def __init__(self, root, *, ttl=3600, capacity=10, retained=20, quota=1024 ** 3):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.ttl, self.capacity, self.retained, self.quota = ttl, capacity, retained, quota
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('''CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, state TEXT NOT NULL,
                created REAL NOT NULL, updated REAL NOT NULL, parameters TEXT NOT NULL,
                filename TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
                reserved INTEGER NOT NULL, error TEXT)''')
            # Zusatztabelle erhält das bisherige jobs-Schema für Update-Rückfälle.
            db.execute('''CREATE TABLE IF NOT EXISTS job_metadata (
                job_id TEXT PRIMARY KEY, original_name TEXT NOT NULL)''')
            db.execute('CREATE TABLE IF NOT EXISTS worker (id INTEGER PRIMARY KEY, heartbeat REAL NOT NULL)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.root / 'jobs.sqlite3', timeout=10)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def path(self, job_id, suffix):
        # IDs stammen ausschließlich aus selbst erzeugten Datenbankeinträgen.
        return self.root / (job_id + suffix)

    def enqueue(self, owner, source, parameters, filename, size, original_name=''):
        now = time.time()
        job_id = secrets.token_hex(16)
        reserve = len(source) + size[0] * size[1] * 5 + 1024 ** 2
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            rows = db.execute('SELECT id, state, owner, reserved FROM jobs').fetchall()
            active = [row for row in rows if row['state'] in ('queued', 'running')]
            used = 0
            for row in rows:
                for suffix in ('.input', '.part', '.png'):
                    try:
                        used += self.path(row['id'], suffix).stat().st_size
                    except FileNotFoundError:
                        pass
            promised = max(0, sum(row['reserved'] for row in rows) - used)
            if (len(active) >= self.capacity or len(rows) >= self.retained or
                    sum(row['reserved'] for row in rows) + reserve > self.quota or
                    shutil.disk_usage(self.root).free < reserve + promised):
                raise QueueFull('Die Warteschlange oder der temporäre Speicher ist voll. Bitte fertige Aufträge entfernen oder später erneut versuchen.')
            try:
                with self.path(job_id, '.input').open('xb') as stream:
                    stream.write(source)
                db.execute('''INSERT INTO jobs
                    (id,owner,state,created,updated,parameters,filename,width,height,reserved,error)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                    (job_id, owner, 'queued', now, now, parameters, filename, *size, reserve, None))
                db.execute('INSERT INTO job_metadata VALUES (?,?)', (job_id, original_name))
            except BaseException:
                self.path(job_id, '.input').unlink(missing_ok=True)
                raise
        return self.get(job_id, owner)

    def get(self, job_id, owner):
        with self.connect() as db:
            return db.execute('''SELECT jobs.*, COALESCE(job_metadata.original_name, '') AS original_name
                              FROM jobs LEFT JOIN job_metadata ON jobs.id=job_metadata.job_id
                              WHERE id=? AND owner=? AND updated>?''',
                              (job_id, owner, time.time() - self.ttl)).fetchone()

    def listing(self, owner):
        with self.connect() as db:
            rows = db.execute('''SELECT jobs.*, COALESCE(job_metadata.original_name, '') AS original_name
                              FROM jobs LEFT JOIN job_metadata ON jobs.id=job_metadata.job_id
                              WHERE updated>? ORDER BY created,id''',
                              (time.time() - self.ttl,)).fetchall()
        active = [row for row in rows if row['state'] in ('queued', 'running')]
        positions = {row['id']: index + 1 for index, row in enumerate(active)}
        own = [dict(row) | {'position': positions.get(row['id']),
                           'expires_at': row['updated'] + self.ttl}
               for row in rows if row['owner'] == owner]
        return own, len(active), sum(row['state'] == 'running' for row in active)

    def claim(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT * FROM jobs WHERE state='queued' ORDER BY created,id LIMIT 1").fetchone()
            if row:
                db.execute("UPDATE jobs SET state='running', updated=? WHERE id=?", (time.time(), row['id']))
            return row

    def state(self, job_id):
        with self.connect() as db:
            row = db.execute('SELECT state FROM jobs WHERE id=?', (job_id,)).fetchone()
            return row['state'] if row else None

    def finish(self, job_id, state, error=None):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT state FROM jobs WHERE id=?', (job_id,)).fetchone()
            if not row:
                return
            if row['state'] != 'running':
                state = row['state']  # Abbruch gewinnt auch gegen ein verspätetes Ergebnis.
            self.path(job_id, '.input').unlink(missing_ok=True)
            self.path(job_id, '.part').unlink(missing_ok=True)
            if state != 'done':
                self.path(job_id, '.png').unlink(missing_ok=True)
            size = self.path(job_id, '.png').stat().st_size if state == 'done' else 0
            db.execute('UPDATE jobs SET state=?, updated=?, reserved=?, error=? WHERE id=?',
                       (state, time.time(), size, error, job_id))

    def cancel(self, job_id, owner):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT state FROM jobs WHERE id=? AND owner=?', (job_id, owner)).fetchone()
            if not row:
                return False
            if row['state'] in ('queued', 'running'):
                db.execute("UPDATE jobs SET state='cancelled', updated=? WHERE id=?", (time.time(), job_id))
                if row['state'] == 'queued':
                    self.path(job_id, '.input').unlink(missing_ok=True)
                    db.execute('UPDATE jobs SET reserved=0 WHERE id=?', (job_id,))
            else:
                db.execute('UPDATE jobs SET updated=0 WHERE id=?', (job_id,))
            return True

    def heartbeat(self):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO worker VALUES (1,?)', (time.time(),))
            db.execute("UPDATE jobs SET updated=? WHERE state='running'", (time.time(),))

    def available(self):
        with self.connect() as db:
            row = db.execute('SELECT heartbeat FROM worker WHERE id=1').fetchone()
            return bool(row and row['heartbeat'] > time.time() - 15)

    def recover(self):
        # Nur der exklusiv gesperrte Worker darf unterbrochene Aufträge bereinigen.
        with self.connect() as db:
            rows = db.execute("SELECT id FROM jobs WHERE state IN ('running','cancelled')").fetchall()
        for row in rows:
            self.finish(row['id'], 'failed', 'Die Berechnung wurde durch einen Neustart unterbrochen. Bitte erneut starten.')

    def cleanup(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            rows = db.execute("SELECT id FROM jobs WHERE state!='running' AND (updated<? OR (state='cancelled' AND reserved=0))",
                              (time.time() - self.ttl,)).fetchall()
            for row in rows:
                try:
                    for suffix in ('.input', '.png', '.part'):
                        self.path(row['id'], suffix).unlink(missing_ok=True)
                except PermissionError:
                    continue  # Ein laufender Windows-Download hält die Datei noch offen.
                db.execute('DELETE FROM jobs WHERE id=?', (row['id'],))
            db.execute('DELETE FROM job_metadata WHERE job_id NOT IN (SELECT id FROM jobs)')
            known = {row['id'] for row in db.execute('SELECT id FROM jobs')}
            for path in self.root.iterdir():
                if re.fullmatch(r'[a-f0-9]{32}\.(input|part|png)', path.name) and path.stem not in known:
                    try:
                        path.unlink()
                    except PermissionError:
                        pass

    @contextmanager
    def worker_lock(self):
        with (self.root / 'worker.lock').open('a+b') as stream:
            stream.seek(0)
            if os.name == 'nt':
                import msvcrt
                if stream.read(1) == b'':
                    stream.write(b'0')
                    stream.flush()
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                yield
            finally:
                if os.name == 'nt':
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def shared_secret(root):
    path = Path(root) / 'session.key'
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        # Ein anderer Webprozess kann den Schlüssel gerade erst anlegen.
        for _ in range(100):
            value = path.read_bytes()
            if len(value) == 32:
                return value
            time.sleep(0.01)
        raise RuntimeError('Der Sitzungsschlüssel ist ungültig.')
    else:
        with os.fdopen(fd, 'wb') as stream:
            value = secrets.token_bytes(32)
            stream.write(value)
        return value
