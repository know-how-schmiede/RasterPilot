"""Separater Worker: python -m rasterpilot.worker."""

import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

from .jobs import JobStore
from .processing import Parameters, load_image, render_png


def render_job(store, job_id):
    with store.connect() as db:
        job = db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
    if not job or job['state'] != 'running':
        return
    with store.path(job_id, '.input').open('rb') as stream:
        image, _ = load_image(stream)
    with image:
        parameters = Parameters.from_dict(json.loads(job['parameters']), image.size)
        with render_png(image, parameters) as data, store.path(job_id, '.part').open('wb') as output:
            output.write(data.getbuffer())
    store.path(job_id, '.part').replace(store.path(job_id, '.png'))


def process_one(store, timeout=180, stopping=lambda: False):
    store.cleanup()
    job = store.claim()
    if not job:
        return False
    child = subprocess.Popen([sys.executable, '-m', 'rasterpilot.worker', '--data-dir', str(store.root),
                              '--render', job['id']], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    started = time.monotonic()
    error = None
    try:
        while child.poll() is None:
            store.heartbeat()
            if stopping() or store.state(job['id']) != 'running':
                error = 'Die Berechnung wurde abgebrochen.'
                break
            if time.monotonic() - started >= timeout:
                error = 'Die Berechnung hat das Zeitlimit überschritten. Bitte Druckgröße oder Auflösung verringern.'
                break
            time.sleep(0.25)
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
    if error or child.returncode or not store.path(job['id'], '.png').exists():
        store.finish(job['id'], 'failed', error or 'Die Berechnung ist fehlgeschlagen. Bitte erneut versuchen.')
    else:
        store.finish(job['id'], 'done')
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', default=os.environ.get('RASTERPILOT_DATA_DIR') or
                        str(Path.cwd() / 'instance' / 'jobs'))
    parser.add_argument('--render', help=argparse.SUPPRESS)
    args = parser.parse_args()
    store = JobStore.configured(args.data_dir)
    timeout = int(os.environ.get('RASTERPILOT_JOB_TIMEOUT', 180))
    if not 1 <= timeout <= 600:
        parser.error('RASTERPILOT_JOB_TIMEOUT muss zwischen 1 und 600 Sekunden liegen.')
    if args.render:
        render_job(store, args.render)
        return
    stopped = False

    def stop(*_):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    with store.worker_lock():
        store.recover()
        while not stopped:
            store.heartbeat()
            if not process_one(store, timeout=timeout, stopping=lambda: stopped):
                time.sleep(0.5)
        with store.connect() as db:
            db.execute('DELETE FROM worker')


if __name__ == '__main__':
    main()
