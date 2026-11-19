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

    def test_atomic_queue_capacity_and_per_owner_limit(self):
        def submit(index):
            try:
                return self.enqueue(str(index))['id']
            except QueueFull:
                return None
        with ThreadPoolExecutor(max_workers=8) as pool:
            ids = list(pool.map(submit, range(8)))
        self.assertEqual(len([value for value in ids if value]), 4)
        self.assertEqual(len(list(self.store.root.glob('*.input'))), 4)
        self.store = JobStore(self.temp.name, quota=1)
        with self.assertRaises(QueueFull):
            self.enqueue('new')

    def test_environment_limits_are_bounded_and_invalid_configuration_is_rejected(self):
        with patch.dict('os.environ', {'RASTERPILOT_QUEUE_LIMIT': '2', 'RASTERPILOT_STORAGE_MIB': '512'}):
            configured = JobStore.configured(self.temp.name)
            self.assertEqual(configured.capacity, 2)
            self.assertEqual(configured.quota, 512 * 1024 ** 2)
        for changes in ({'RASTERPILOT_QUEUE_LIMIT': '0'}, {'RASTERPILOT_JOB_TTL': '59'},
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

    def test_owner_limit_and_fifo(self):
        first = self.enqueue()
        with self.assertRaises(QueueFull):
            self.enqueue()
        second = self.enqueue('b')
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
        self.assertEqual(b.post('/api/jobs', data=data(), headers=headers).status_code, 429)
        self.assertEqual(b.delete(f'/api/jobs/{job_id}', headers=headers).status_code, 200)
        self.assertEqual(self.store.state(job_id), 'cancelled')

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
