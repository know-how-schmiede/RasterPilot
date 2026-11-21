from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch

from PIL import Image

from rasterpilot import create_app
from rasterpilot.jobs import JobStore, QueueFull, shared_secret
from rasterpilot.worker import process_one


class JobsTest(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = JobStore(self.temp.name)
        self.values = dict(width_cm=2.54, ppi=64, spacing_mm=3.175, coverage=65, angle_deg=30)
        stream = BytesIO()
        with Image.new('RGBA', (64, 32), 'red') as image:
            image.save(stream, format='PNG')
        self.source = stream.getvalue()

    def enqueue(self, owner='a'):
        return self.store.enqueue(owner, self.source, json.dumps(self.values), 'original_rp_25.4_64ppi_30G.png', (64, 32))

    def test_atomic_queue_capacity_includes_multiple_jobs_of_the_same_owner(self):
        def submit(index):
            try:
                return self.enqueue()['id']
            except QueueFull:
                return None
        with ThreadPoolExecutor(max_workers=16) as pool:
            ids = list(pool.map(submit, range(16)))
        self.assertEqual(len([value for value in ids if value]), 10)
        self.assertEqual(len(list(self.store.root.glob('*.input'))), 10)
        self.store = JobStore(self.temp.name, quota=1)
        with self.assertRaises(QueueFull):
            self.enqueue('new')

    def test_environment_limits_are_bounded_and_invalid_configuration_is_rejected(self):
        with patch.dict('os.environ', {'RASTERPILOT_QUEUE_LIMIT': '2', 'RASTERPILOT_STORAGE_MIB': '512'}):
            configured = JobStore.configured(self.temp.name)
            self.assertEqual(configured.capacity, 2)
            self.assertEqual(configured.quota, 512 * 1024 ** 2)
        for changes in ({'RASTERPILOT_QUEUE_LIMIT': '0'}, {'RASTERPILOT_QUEUE_LIMIT': '11'},
                        {'RASTERPILOT_RETAINED_JOBS': '21'}, {'RASTERPILOT_JOB_TTL': '59'},
                        {'RASTERPILOT_STORAGE_MIB': '1025'}, {'RASTERPILOT_RETAINED_JOBS': 'invalid'}):
            with self.subTest(changes=changes), patch.dict('os.environ', changes), self.assertRaises(ValueError):
                JobStore.configured(self.temp.name)
        with patch('rasterpilot.jobs.shutil.disk_usage') as usage:
            usage.return_value.free = 0
            with self.assertRaises(QueueFull):
                self.enqueue()
        self.assertEqual(list(self.store.root.glob('*.input')), [])

    def test_running_job_cancellation_kills_child_and_frees_files(self):
        job = self.enqueue()
        def cancel():
            self.store.cancel(job['id'], 'a')
            return True
        process_one(self.store, stopping=cancel)
        self.assertEqual(self.store.state(job['id']), 'cancelled')
        self.assertFalse(self.store.path(job['id'], '.input').exists())
        self.assertFalse(self.store.path(job['id'], '.png').exists())

    def test_multiple_own_jobs_keep_fifo_order(self):
        first = self.enqueue()
        second = self.enqueue()
        self.assertEqual(self.store.claim()['id'], first['id'])
        self.assertEqual(self.store.claim()['id'], second['id'])

    def test_real_subprocess_worker_and_png_metadata(self):
        job = self.enqueue()
        self.assertTrue(process_one(self.store))
        self.assertEqual(self.store.state(job['id']), 'done')
        self.assertFalse(self.store.path(job['id'], '.input').exists())
        with Image.open(self.store.path(job['id'], '.png')) as result:
            self.assertEqual(result.size, (64, 32))
            self.assertAlmostEqual(result.info['dpi'][0], 64, delta=0.02)
        self.assertFalse(process_one(self.store))

    def test_timeout_and_child_failure_release_input_and_partial_output(self):
        for invalid, timeout in ((False, 0), (True, 10)):
            with self.subTest(invalid=invalid):
                job = self.enqueue()
                if invalid:
                    self.store.path(job['id'], '.input').write_bytes(b'broken image')
                process_one(self.store, timeout=timeout)
                self.assertEqual(self.store.state(job['id']), 'failed')
                self.assertFalse(self.store.path(job['id'], '.input').exists())
                self.assertFalse(self.store.path(job['id'], '.png').exists())
                self.assertFalse(self.store.path(job['id'], '.part').exists())

    def test_cancellation_wins_over_worker_result_and_recovers_after_restart(self):
        job = self.enqueue()
        self.store.claim()
        self.assertFalse(self.store.cancel(job['id'], 'foreign'))
        self.store.cancel(job['id'], 'a')
        self.store.path(job['id'], '.png').write_bytes(b'late result')
        self.store.finish(job['id'], 'done')
        self.assertEqual(self.store.state(job['id']), 'cancelled')
        self.assertFalse(self.store.path(job['id'], '.png').exists())
        second = self.enqueue()
        self.store.claim()
        self.store.recover()
        self.assertEqual(self.store.state(second['id']), 'failed')
        self.assertFalse(self.store.path(second['id'], '.input').exists())

    def test_cancel_queued_expiry_and_orphan_cleanup(self):
        job = self.enqueue()
        self.store.cancel(job['id'], 'a')
        self.assertFalse(self.store.path(job['id'], '.input').exists())
        with self.store.connect() as db:
            db.execute('UPDATE jobs SET updated=0')
        self.store.path('f' * 32, '.part').write_bytes(b'partial')
        self.store.path('foreign', '.png').write_bytes(b'not a job file')
        self.store.cleanup()
        self.assertIsNone(self.store.get(job['id'], 'a'))
        self.assertEqual(list(self.store.root.glob('*.part')), [])
        self.assertEqual(list(self.store.root.glob('*.input')), [])
        self.assertTrue(self.store.path('foreign', '.png').exists())

    def test_worker_lock_and_persistent_shared_secret(self):
        with self.store.worker_lock():
            with self.assertRaises(OSError):
                with self.store.worker_lock():
                    self.fail('Zweiter Worker darf die Sperre nicht erhalten.')
        with ThreadPoolExecutor(max_workers=4) as pool:
            secrets = list(pool.map(lambda _: shared_secret(self.store.root), range(4)))
        self.assertTrue(all(value == secrets[0] and len(value) == 32 for value in secrets))

    def test_original_name_metadata_preserves_old_schema_and_is_cleaned(self):
        now = time.time()
        old_id = 'e' * 32
        with self.store.connect() as db:
            # Der INSERT der vorherigen Version muss nach der Erweiterung funktionieren.
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                       (old_id, 'a', 'done', now, now, '{}', 'old.png', 1, 1, 0, None))
        migrated = JobStore(self.temp.name)
        self.assertEqual(migrated.get(old_id, 'a')['original_name'], '')
        job = migrated.enqueue('a', self.source, json.dumps(self.values), 'out.png', (64, 32),
                               original_name='Eichhörnchen.original.jpg')
        self.assertEqual(migrated.get(job['id'], 'a')['original_name'], 'Eichhörnchen.original.jpg')
        with migrated.connect() as db:
            db.execute('UPDATE jobs SET updated=0')
        migrated.cleanup()
        with migrated.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM job_metadata').fetchone()[0], 0)

    def test_api_list_is_private_with_global_counts_and_completed_downloads(self):
        app = create_app({'DATA_DIR': self.temp.name, 'SECRET_KEY': 'test'})
        a, b = app.test_client(), app.test_client()
        headers = {'X-RasterPilot-Request': '1'}
        self.store.heartbeat()
        def submit(client, name):
            return client.post('/api/jobs', data={'image': (BytesIO(self.source), name.replace('\\', '\\\\')),
                               'parameters': json.dumps(self.values)}, headers=headers)
        first = submit(a, r'C:\privat\Eichhörnchen.original.png')
        foreign = submit(b, 'fremdes-bild.png')
        own = a.get('/api/jobs', headers=headers)
        self.assertEqual(own.status_code, 200)
        self.assertEqual(own.headers['Cache-Control'], 'no-store')
        self.assertEqual(own.json['capacity'], 10)
        self.assertEqual(own.json['active'], 2)
        self.assertEqual(len(own.json['jobs']), 1)
        self.assertEqual(own.json['jobs'][0]['original_name'], 'Eichhörnchen.original.png')
        self.assertNotIn('privat', own.get_data(as_text=True))
        self.assertNotIn(foreign.json['id'], own.get_data(as_text=True))
        self.assertNotIn('fremdes-bild', own.get_data(as_text=True))
        self.assertNotIn('parameters', own.json['jobs'][0])
        self.assertEqual(b.get('/api/jobs', headers=headers).json['jobs'][0]['position'], 2)
        self.assertEqual(a.get('/api/jobs').status_code, 403)
        self.assertEqual(a.get('/api/jobs', headers={**headers, 'Origin': 'https://foreign.example'}).status_code, 403)
        process_one(self.store)
        later = submit(a, 'zweites.png')
        rows = a.get('/api/jobs', headers=headers).json['jobs']
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['state'], 'done')
        self.assertGreater(rows[0]['expires_at'], time.time())
        response = a.get(f'/api/jobs/{first.json["id"]}/result', headers=headers, buffered=True)
        self.assertEqual(response.status_code, 200)
        response.close()
        self.assertEqual(b.get(f'/api/jobs/{first.json["id"]}/result', headers=headers).status_code, 404)
        a.delete(f'/api/jobs/{first.json["id"]}', headers=headers)
        self.assertEqual([row['id'] for row in a.get('/api/jobs', headers=headers).json['jobs']], [later.json['id']])

    def test_one_browser_can_fill_ten_queue_places_and_eleventh_is_rejected(self):
        app = create_app({'DATA_DIR': self.temp.name, 'SECRET_KEY': 'test'})
        client = app.test_client()
        headers = {'X-RasterPilot-Request': '1'}
        self.store.heartbeat()
        for index in range(11):
            response = client.post('/api/jobs', data={'image': (BytesIO(self.source), f'motiv-{index}.png'),
                                   'parameters': json.dumps(self.values)}, headers=headers)
            self.assertEqual(response.status_code, 202 if index < 10 else 429)
        self.assertEqual(len(client.get('/api/jobs', headers=headers).json['jobs']), 10)

    def test_multiple_web_processes_share_cookie_identity_and_queue_limit(self):
        app_a = create_app({'DATA_DIR': self.temp.name})
        app_b = create_app({'DATA_DIR': self.temp.name})
        a, b = app_a.test_client(), app_b.test_client()
        a.get('/')
        b.set_cookie('session', a.get_cookie('session').value)
        self.store.heartbeat()
        headers = {'X-RasterPilot-Request': '1'}
        def data():
            return {'image': (BytesIO(self.source), 'original.png'), 'parameters': json.dumps(self.values)}
        response = a.post('/api/jobs', data=data(), headers=headers)
        self.assertEqual(response.status_code, 202)
        job_id = response.json['id']
        self.assertEqual(b.get(f'/api/jobs/{job_id}', headers=headers).status_code, 200)
        self.assertEqual(b.get(f'/api/jobs/{job_id}/result', headers=headers).status_code, 409)
        second = b.post('/api/jobs', data=data(), headers=headers)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(b.delete(f'/api/jobs/{job_id}', headers=headers).status_code, 200)
        self.assertEqual(self.store.state(job_id), 'cancelled')
        self.assertEqual(b.delete(f'/api/jobs/{second.json["id"]}', headers=headers).status_code, 200)

    def test_api_sessions_readiness_and_worker_is_a_separate_process(self):
        app = create_app({'DATA_DIR': self.temp.name, 'SECRET_KEY': 'test'})
        a, b = app.test_client(), app.test_client()
        headers = {'X-RasterPilot-Request': '1'}
        def submit():
            return a.post('/api/render', data={'image': (BytesIO(self.source), 'original.png'),
                          'parameters': json.dumps(self.values)}, headers=headers)
        self.assertEqual(a.get('/ready').status_code, 503)
        self.assertEqual(submit().status_code, 503)
        worker = subprocess.Popen([sys.executable, '-m', 'rasterpilot.worker', '--data-dir', self.temp.name],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 10
            while not self.store.available() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertEqual(a.get('/ready').status_code, 200)
            accepted = submit()
            self.assertEqual(accepted.status_code, 202)
            self.assertIn('HttpOnly', accepted.headers['Set-Cookie'])
            self.assertIn('SameSite=Strict', accepted.headers['Set-Cookie'])
            job_id = accepted.json['id']
            for url in (f'/api/jobs/{job_id}', f'/api/jobs/{job_id}/result'):
                self.assertEqual(b.get(url, headers=headers).status_code, 404)
                self.assertEqual(b.get(url, headers={**headers, 'Origin': 'https://foreign.example'}).status_code, 403)
            self.assertEqual(b.delete(f'/api/jobs/{job_id}', headers=headers).status_code, 404)
            while self.store.state(job_id) in ('queued', 'running') and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertEqual(self.store.state(job_id), 'done')
            response = a.get(f'/api/jobs/{job_id}/result', headers=headers, buffered=True)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            response.close()
            a.delete(f'/api/jobs/{job_id}', headers=headers)
            self.assertEqual(a.get(f'/api/jobs/{job_id}', headers=headers).status_code, 404)
        finally:
            worker.terminate()
            worker.wait(timeout=10)


if __name__ == '__main__':
    unittest.main()
