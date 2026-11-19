from io import BytesIO
import json
import unittest

import numpy as np
from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.test import stream_encode_multipart

from rasterpilot import create_app
from test_processing import encoded, options


class ImageApiTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.testing = True
        self.client = self.app.test_client()
        self.headers = {'X-RasterPilot-Request': '1'}

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
        response = self.client.post('/api/render', data=self.data(angle_deg=45), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'image/png')
        self.assertIn('motiv_rasterpilot_25.4mm_256ppi.png', response.headers['Content-Disposition'])
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with Image.open(BytesIO(response.data)) as image:
            self.assertEqual(image.size, (256, 256))
            self.assertAlmostEqual(image.info['dpi'][0], 256, delta=0.02)
        response.close()

    def test_cross_site_and_simple_form_requests_are_rejected(self):
        for headers in ({}, {**self.headers, 'Origin': 'https://foreign.example'},
                        {**self.headers, 'Origin': 'null'}, {**self.headers, 'Origin': 'http://[bad'}):
            response = self.client.post('/api/render', data=self.data(), headers=headers)
            self.assertEqual(response.status_code, 403)
            self.assertNotIn('Access-Control-Allow-Origin', response.headers)

    def test_render_keeps_full_nonsquare_image_despite_legacy_crop_values(self):
        with Image.new('RGBA', (256, 128), 'red') as source:
            source.paste('blue', (128, 0, 256, 128))
            data = dict(image=(encoded(source, format='PNG'), 'motiv.png'),
                        parameters=json.dumps(options(coverage=100, angle_deg=-30,
                            x=128, y=0, crop_width=128, crop_height=128)))
            response = self.client.post('/api/render', data=data, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['X-Image-Width'], '256')
            self.assertEqual(response.headers['X-Image-Height'], '128')
            with Image.open(BytesIO(response.data)) as result:
                np.testing.assert_array_equal(np.array(result), np.array(source))
            response.close()

    def test_same_origin_request_works(self):
        response = self.client.post('/api/render', data=self.data(),
                                    headers={**self.headers, 'Origin': 'http://localhost'})
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_bad_parameters_missing_and_mislabeled_files(self):
        for data in ({}, {'parameters': '{}'},
                     {'parameters': '[]', 'image': (BytesIO(b'bad'), 'fake.png')},
                     {**self.data(), 'parameters': 'broken JSON'},
                     self.data(coverage=150), self.data(angle_deg=181)):
            with self.subTest():
                response = self.client.post('/api/render', data=data, headers=self.headers)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json)

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
