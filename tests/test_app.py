import unittest

from rasterpilot import create_app
from rasterpilot.version import __version__


class AppTest(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_health_reports_version(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'status': 'ok', 'version': __version__})

    def test_home_and_assets(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Dein Motiv auflockern', response.get_data(as_text=True))
        for path in ('/static/app.js', '/static/style.css'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            response.close()


if __name__ == '__main__':
    unittest.main()
