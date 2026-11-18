from io import BytesIO
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageCms

from rasterpilot.processing import ImageError, Parameters, load_image, prepare_preview, render_png


def options(**changes):
    values = dict(width_cm=2.54, ppi=256, x=0, y=0, crop_width=256,
                  crop_height=256, spacing_mm=3.175, coverage=65)
    values.update(changes)
    return values


def encoded(image, **kwargs):
    data = BytesIO()
    image.save(data, **kwargs)
    data.seek(0)
    return data


class ProcessingTest(unittest.TestCase):
    def result(self, image, **changes):
        p = Parameters.from_dict(options(**changes), image.size)
        with render_png(image, p) as data, Image.open(data) as result:
            return np.array(result), result.info.copy(), result.size

    def test_dimensions_crop_and_ppi_metadata(self):
        image = Image.new('RGBA', (256, 256), 'white')
        array, info, size = self.result(image, width_cm=5.08, ppi=100, crop_height=128)
        self.assertEqual(size, (200, 100))
        self.assertAlmostEqual(info['dpi'][0], 100, delta=0.02)
        self.assertEqual(ImageCms.ImageCmsProfile(BytesIO(info['icc_profile'])).profile.xcolor_space.strip(), 'RGB')
        self.assertLessEqual(set(np.unique(array[:, :, 3])), {0, 255})

    def test_zero_and_full_coverage_keep_white_motif(self):
        image = Image.new('RGBA', (256, 256), 'white')
        for coverage in (0, 100):
            with self.subTest(coverage=coverage):
                array, _, _ = self.result(image, coverage=coverage)
                self.assertTrue(np.all(array[:, :, 3] == (255 if coverage else 0)))
                if coverage:
                    self.assertTrue(np.all(array[:, :, :3] == 255))

    def test_coverage_is_monotonic_and_matches_area_including_high_coverage(self):
        image = Image.new('RGBA', (256, 256), 'white')
        previous = np.zeros((256, 256), dtype=bool)
        for coverage in (5, 25, 50, 65, 78, 85, 95, 100):
            with self.subTest(coverage=coverage):
                array, _, _ = self.result(image, coverage=coverage)
                visible = array[:, :, 3] == 255
                self.assertTrue(np.all(visible | ~previous))
                self.assertAlmostEqual(visible.mean(), coverage / 100, delta=0.012)
                previous = visible

    def test_transparency_is_respected_and_applied_once(self):
        image = Image.new('RGBA', (256, 256), (12, 134, 231, 128))
        image.paste((255, 0, 0, 0), (0, 0, 128, 256))
        array, _, _ = self.result(image, coverage=50)
        self.assertTrue(np.all(array[:, :128, 3] == 0))
        right = array[:, 128:]
        visible = right[:, :, 3] == 255
        self.assertAlmostEqual(visible.mean(), 0.5 * 128 / 255, delta=0.012)
        self.assertTrue(np.all(np.abs(right[visible, :3].astype(int) - [12, 134, 231]) <= 2))

    def test_crop_is_taken_before_scaling(self):
        image = Image.new('RGBA', (256, 256), 'red')
        image.paste('blue', (128, 0, 256, 256))
        array, _, size = self.result(image, x=128, crop_width=128, coverage=100)
        self.assertEqual(size, (256, 512))
        self.assertTrue(np.all(array[:, :, :3] == [0, 0, 255]))

    def test_scaling_does_not_mix_in_invisible_colors(self):
        image = Image.new('RGBA', (256, 256), (0, 0, 255, 0))
        image.paste('red', (64, 64, 192, 192))
        array, _, _ = self.result(image, ppi=128, coverage=100)
        visible = array[:, :, 3] == 255
        self.assertTrue(np.all(array[visible, :3] == [255, 0, 0]))

    def test_invalid_parameters_and_limits(self):
        for changes in (dict(width_cm=float('nan')), dict(coverage=float('inf')),
                        dict(ppi=True), dict(ppi=100.5), dict(width_cm='28'),
                        dict(x=200, crop_width=100), dict(y=-1), dict(crop_width=0),
                        dict(width_cm=200, ppi=1200), dict(spacing_mm=0.1, ppi=36),
                        dict(coverage=101), dict(width_cm=10 ** 1000)):
            with self.subTest(changes=changes), self.assertRaises(ImageError):
                Parameters.from_dict(options(**changes), (256, 256))

    def test_half_pixel_rounding_matches_browser(self):
        p = Parameters.from_dict(options(width_cm=2.54, ppi=101, crop_width=2, crop_height=1), (2, 1))
        self.assertEqual(p.output_size(), (101, 51))

    def test_decode_exif_orientation_and_remove_metadata(self):
        image = Image.new('RGB', (30, 20), 'red')
        exif = Image.Exif(); exif[274] = 6
        decoded, notes = load_image(encoded(image, format='JPEG', exif=exif))
        with decoded:
            self.assertEqual(decoded.size, (20, 30))
            self.assertEqual(decoded.mode, 'RGBA')
            self.assertEqual(decoded.info, {})
            self.assertIn('sRGB', notes[0])

    def test_profile_and_palette_transparency(self):
        image = Image.new('P', (2, 1))
        image.putpalette([255, 255, 255, 255, 0, 0] + [0] * 762)
        image.putpixel((1, 0), 1)
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        decoded, notes = load_image(encoded(image, format='PNG', transparency=0, icc_profile=profile))
        with decoded:
            self.assertEqual(notes, [])
            self.assertEqual(decoded.getpixel((0, 0))[3], 0)
            self.assertEqual(decoded.getpixel((1, 0)), (255, 0, 0, 255))

    def test_malformed_image_profile_and_animation_rejected(self):
        image = Image.new('RGB', (2, 2), 'red')
        for data in (BytesIO(b'not an image'), encoded(image, format='GIF'),
                     encoded(image, format='PNG', icc_profile=b'invalid profile'),
                     encoded(image, format='PNG', save_all=True, append_images=[Image.new('RGB', (2, 2), 'blue')]),
                     encoded(Image.new('CMYK', (2, 2)), format='JPEG')):
            with self.subTest(), self.assertRaises(ImageError):
                load_image(data)

    def test_grayscale_with_rgb_profile_and_16_bit_range(self):
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        gray = Image.new('L', (2, 2), 128)
        decoded, _ = load_image(encoded(gray, format='PNG', icc_profile=profile))
        with decoded:
            self.assertEqual(decoded.getpixel((0, 0)), (128, 128, 128, 255))
        gray16 = Image.fromarray(np.array([[0, 32768, 65535]], dtype=np.uint16))
        decoded, _ = load_image(encoded(gray16, format='PNG'))
        with decoded:
            self.assertEqual([decoded.getpixel((x, 0))[0] for x in range(3)], [0, 128, 255])

    def test_file_and_decoded_pixel_limits(self):
        with patch('rasterpilot.processing.pipeline.MAX_FILE_BYTES', 4), self.assertRaises(ImageError):
            load_image(BytesIO(b'12345'))
        with patch('rasterpilot.processing.pipeline.MAX_INPUT_PIXELS', 3), self.assertRaises(ImageError):
            load_image(encoded(Image.new('RGB', (2, 2)), format='PNG'))

    def test_prepare_preview_retains_aspect_and_alpha(self):
        image = Image.new('RGBA', (2000, 1000), (255, 255, 255, 128))
        with prepare_preview(image) as data, Image.open(data) as preview:
            self.assertEqual(preview.size, (1600, 800))
            self.assertEqual(preview.getpixel((100, 100))[3], 128)


if __name__ == '__main__':
    unittest.main()
