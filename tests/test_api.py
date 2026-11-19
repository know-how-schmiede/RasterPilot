from io import BytesIO
import json
import unittest
from tempfile import TemporaryDirectory
from urllib.parse import unquote

import numpy as np
from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.test import stream_encode_multipart

from rasterpilot import create_app
from test_processing import encoded, options
from rasterpilot.worker import process_one


class ImageApiTest(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = create_app({'DATA_DIR': self.temp.name, 'SECRET_KEY': 'test'})
        self.store = self.app.extensions['jobs']
        self.store.heartbeat()
        self.app.testing = True
        self.client = self.app.test_client()
        self.headers = {'X-RasterPilot-Request': '1'}

    def render(self, data, headers=None):
        response = self.client.post('/api/jobs', data=data, headers=self.headers if headers is None else headers)
        if response.status_code != 202:
            return response
        job_id = response.json['id']
        self.assertTrue(process_one(self.store))
        result = self.client.get(f'/api/jobs/{job_id}/result', headers=self.headers, buffered=True)
        self.client.delete(f'/api/jobs/{job_id}', headers=self.headers)
        self.store.cleanup()
        return result

    def data(self, **changes):
        return dict(image=(encoded(Image.new('RGBA', (256, 256), 'white'), format='PNG'), 'motiv.png'),
                    parameters=json.dumps(options(**changes)))

    def test_prepare_normalizes_image_and_returns_dimensions(self):
        response = self.client.post('/api/prepare', data=self.data(), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['X-Image-Width'], '256')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with Image.open(BytesIO(response.data)) as image:
            self.assertEqual(image.size, (256, 256))
        response.close()

    def test_render_is_an_attachment_with_expected_png_and_metadata(self):
        response = self.render(data=self.data(angle_deg=45), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'image/png')
        self.assertIn('motiv_rp_25.4_256ppi_45G.png', response.headers['Content-Disposition'])
        self.assertEqual(unquote(response.headers['X-Download-Name']), 'motiv_rp_25.4_256ppi_45G.png')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with Image.open(BytesIO(response.data)) as image:
            self.assertEqual(image.size, (256, 256))
            self.assertAlmostEqual(image.info['dpi'][0], 256, delta=0.02)
        response.close()

    def test_export_name_preserves_unicode_and_dots_with_print_settings(self):
        data = self.data(width_cm=2.81, ppi=100, angle_deg=-45)
        data['image'] = (data['image'][0], 'Eichhörnchen.v2.JPEG')
        response = self.render(data=data, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        expected = 'Eichhörnchen.v2_rp_28.1_100ppi_-45G.png'
        self.assertEqual(unquote(response.headers['X-Download-Name']), expected)
        disposition = response.headers['Content-Disposition']
        self.assertIn("filename*=UTF-8''", disposition)
        self.assertEqual(unquote(disposition.split("filename*=UTF-8''", 1)[1]), expected)
        response.close()

    def test_export_name_removes_paths_and_invalid_characters_and_limits_length(self):
        for name, expected_stem in (
                ('C:\\fakepath\\mein Motiv.png', 'mein Motiv'),
                ('../../mein:Motiv?.jpg', 'mein_Motiv_'),
                ('motiv', 'motiv'),
                ('.png', 'motiv'),
                ('ä' * 200 + '.png', 'ä' * 116)):
            with self.subTest(name=name):
                data = self.data(angle_deg=-0.0)
                # Backslashes im zitierten Multipart-Dateinamen maskieren.
                data['image'] = (data['image'][0], name.replace('\\', '\\\\'))
                response = self.render(data=data, headers=self.headers)
                self.assertEqual(response.status_code, 200)
                filename = unquote(response.headers['X-Download-Name'])
                self.assertEqual(filename, expected_stem + '_rp_25.4_256ppi_0G.png')
                self.assertLessEqual(len(filename.encode('utf-8')), 255)
                response.close()

    def test_cross_site_and_simple_form_requests_are_rejected(self):
        for headers in ({}, {**self.headers, 'Origin': 'https://foreign.example'},
                        {**self.headers, 'Origin': 'null'}, {**self.headers, 'Origin': 'http://[bad'}):
            response = self.render(data=self.data(), headers=headers)
            self.assertEqual(response.status_code, 403)
            self.assertNotIn('Access-Control-Allow-Origin', response.headers)

    def test_render_keeps_full_nonsquare_image_despite_legacy_crop_values(self):
        with Image.new('RGBA', (256, 128), 'red') as source:
            source.paste('blue', (128, 0, 256, 128))
            data = dict(image=(encoded(source, format='PNG'), 'motiv.png'),
                        parameters=json.dumps(options(coverage=100, angle_deg=-30,
                            x=128, y=0, crop_width=128, crop_height=128)))
            response = self.render(data=data, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['X-Image-Width'], '256')
            self.assertEqual(response.headers['X-Image-Height'], '128')
            with Image.open(BytesIO(response.data)) as result:
                np.testing.assert_array_equal(np.array(result), np.array(source))
            response.close()

    def test_same_origin_request_works(self):
        response = self.render(data=self.data(),
                                    headers={**self.headers, 'Origin': 'http://localhost'})
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_bad_parameters_missing_and_mislabeled_files(self):
        for data in ({}, {'parameters': '{}'},
                     {'parameters': '[]', 'image': (BytesIO(b'bad'), 'fake.png')},
                     {**self.data(), 'parameters': 'broken JSON'},
                     self.data(coverage=150), self.data(angle_deg=181), self.data(mode='unknown'),
                     self.data(mode='luminance', gamma=0), self.data(mode='luminance', ink_color='red'),
                     self.data(mode='luminance', black_point=200, white_point=100)):
            with self.subTest():
                response = self.render(data=data, headers=self.headers)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json)

    def test_new_modes_return_complete_png_and_keep_export_name(self):
        for mode in ('luminance', 'alpha'):
            with self.subTest(mode=mode):
                data = self.data(mode=mode, ink_color='#ab421c')
                with Image.new('RGBA', (256, 128), (0, 0, 0, 255)) as source:
                    source.paste((0, 0, 0, 0), (0, 0, 128, 128))
                    data['image'] = (encoded(source, format='PNG'), 'original.png')
                response = self.render(data=data, headers=self.headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(unquote(response.headers['X-Download-Name']), 'original_rp_25.4_256ppi_0G.png')
                with Image.open(BytesIO(response.data)) as result:
                    array = np.array(result)
                    self.assertEqual(result.size, (256, 128))
                    self.assertAlmostEqual(result.info['dpi'][0], 256, delta=0.02)
                    self.assertIn('icc_profile', result.info)
                    self.assertTrue(np.all(array[:, :128, 3] == 0))
                    self.assertTrue(np.all(array[:, 128:, 3] == 255))
                    self.assertTrue(np.all(array[:, 128:, :3] == ([171, 66, 28] if mode == 'luminance' else [0, 0, 0])))
                response.close()

    def test_request_size_limit_is_json(self):
        self.app.config['MAX_CONTENT_LENGTH'] = 128
        response = self.client.post('/api/prepare', data=self.data(), headers=self.headers)
        self.assertEqual(response.status_code, 413)
        self.assertIn('error', response.json)

    def test_file_over_one_mib_is_streamed_despite_small_form_memory_limit(self):
        pixels = np.random.default_rng(1).integers(0, 256, (700, 700, 3), dtype=np.uint8)
        with Image.fromarray(pixels) as image:
            data = encoded(image, format='PNG')
        self.assertGreater(data.getbuffer().nbytes, 1024 * 1024)
        stream, length, boundary = stream_encode_multipart(
            {'image': FileStorage(data, filename='large.png', content_type='image/png')}, use_tempfile=False)
        with stream:
            response = self.client.post('/api/prepare', input_stream=stream, content_length=length,
                content_type=f'multipart/form-data; boundary={boundary}', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['X-Image-Width'], '700')
            response.close()


if __name__ == '__main__':
    unittest.main()
