"""Assemble rendered frames into animated assets: python build.py <framesDir> <outDir>"""
import sys, glob, os
from PIL import Image

frames_dir, out = sys.argv[1], sys.argv[2]
MATTE = {'light': (255, 255, 255, 255), 'dark': (13, 17, 23, 255)}  # GIF has no soft alpha; matte to GitHub bg
for theme in ('light', 'dark'):
    fr = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(os.path.join(frames_dir, theme, '*.png')))]
    ms = 50
    for size, tag in (((720, 400), ''), ((360, 200), '-small')):
        f2 = fr if size == fr[0].size else [im.resize(size, Image.LANCZOS) for im in fr]
        base = os.path.join(out, f'welcome-{theme}{tag}')
        f2[0].save(base + '.png', save_all=True, append_images=f2[1:], duration=ms, loop=0, optimize=True)  # APNG
        f2[0].save(base + '.webp', save_all=True, append_images=f2[1:], duration=ms, loop=0, lossless=True, method=4)
        gif = []
        for im in f2:
            m = Image.new('RGBA', size, MATTE[theme]); m.alpha_composite(im)
            gif.append(m.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT))
        gif[0].save(base + '.gif', save_all=True, append_images=gif[1:], duration=ms, loop=0, optimize=True)
    fr[int(len(fr) * .85)].save(os.path.join(out, f'welcome-{theme}-still.png'), optimize=True)  # reduced motion / og
