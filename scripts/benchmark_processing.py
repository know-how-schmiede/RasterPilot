"""Reproduzierbarer Durchlauf ohne Benutzerdaten: python scripts/benchmark_processing.py."""

import argparse
import ctypes
from io import BytesIO
import json
import platform
from time import perf_counter

import numpy as np
from PIL import Image

from rasterpilot.processing import Parameters, load_image, render_png


def peak_mib():
    if platform.system() == 'Windows':
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [
                (name, ctypes.c_size_t) for name in (
                    'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage',
                    'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage',
                    'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage')]

        kernel = ctypes.WinDLL('kernel32')
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        api = ctypes.WinDLL('psapi').GetProcessMemoryInfo
        api.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        if not api(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            raise ctypes.WinError()
        return counters.PeakWorkingSetSize / 1024 ** 2
    import resource
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value / (1024 ** 2 if platform.system() == 'Darwin' else 1024)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--width-cm', type=float, default=28,
                        help='Druckbreite des quadratischen Testmotivs (Standard: 28 cm).')
    parser.add_argument('--source-side', type=int, default=2400,
                        help='Kantenlänge des synthetischen Originals (Standard: 2400 Pixel).')
    parser.add_argument('--pattern', choices=('noise', 'gradient'), default='noise',
                        help='Rauschen für PNG-Kompression oder Verlauf für große dekodierte Eingaben.')
    parser.add_argument('--mode', choices=('color', 'luminance', 'alpha', 'affinity'), default='color',
                        help='Rastermodus (Standard: color).')
    args = parser.parse_args()
    if args.source_side < 1 or args.source_side ** 2 > 40_000_000:
        parser.error('Das synthetische Original muss zwischen 1 Pixel und 40 Megapixel groß sein.')
    # Deterministisches Rauschmotiv belastet PNG-Kompression stärker als Flächen.
    source = BytesIO()
    if args.pattern == 'noise':
        pixels = np.random.default_rng(2026).integers(0, 256,
            (args.source_side, args.source_side, 3), dtype=np.uint8)
        image = Image.fromarray(pixels)
        del pixels
    else:
        image = Image.linear_gradient('L').resize((args.source_side, args.source_side)).convert('RGB')
    with image:
        image.save(source, format='PNG')
    input_bytes = source.tell()
    source.seek(0)
    start = perf_counter()
    image, _ = load_image(source)
    with image:
        parameters = Parameters.from_dict(dict(width_cm=args.width_cm, ppi=300,
            spacing_mm=1, coverage=65, angle_deg=0, mode=args.mode), image.size)
        with render_png(image, parameters) as result:
            output_bytes = result.getbuffer().nbytes
    print(json.dumps(dict(system=platform.platform(), python=platform.python_version(),
        input_size=[args.source_side, args.source_side], pattern=args.pattern, mode=args.mode,
        output_size=parameters.output_size(), seconds=round(perf_counter() - start, 3),
        peak_process_mib=round(peak_mib(), 1), input_mib=round(input_bytes / 1024 ** 2, 2),
        output_mib=round(output_bytes / 1024 ** 2, 2)), ensure_ascii=False))


if __name__ == '__main__':
    main()
