#v0.2

import h5py
import numpy as np
import random
import multiprocessing as mp
from PIL import Image, ImageFont, ImageDraw


import os
from functools import lru_cache
from typing import Optional, List, Tuple

import freetype
from PIL import ImageFont

MAC_FONT_DIRS = [
    os.path.expanduser("~/Library/Fonts"),
    "/Library/Fonts",
    "/System/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
]

PRIORITY_FONT_FILES = [
    "NotoSansMono-Regular.ttf",
    "NotoSansTifinagh-Regular.otf",
    "Menlo.ttc",
    "EuphemiaCAS.ttc",
]

def ensure_single_codepoint(s: str) -> str:
    cps = list(s)
    if len(cps) != 1:
        raise ValueError("Expected exactly one Unicode code point.")
    return cps[0]

def find_font_file(filename: str) -> Optional[str]:
    for d in MAC_FONT_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    return None

@lru_cache(maxsize=8192)
def _glyph_index(font_path: str, codepoint: int) -> int:
    face = freetype.Face(font_path)
    try:
        face.select_charmap(freetype.FT_ENCODING_UNICODE)
    except Exception:
        pass
    return face.get_char_index(codepoint)

def font_has_glyph(font_path: str, codepoint: int) -> bool:
    return _glyph_index(font_path, codepoint) != 0

@lru_cache(maxsize=256)
def _load_pil_font(font_path: str, font_size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path, font_size)

def pick_font_for_codepoint(codepoint: int, font_size: int) -> Tuple[str, ImageFont.FreeTypeFont]:
    tried: List[str] = []
    for fname in PRIORITY_FONT_FILES:
        fpath = find_font_file(fname)
        if not fpath:
            continue
        tried.append(fpath)

        # strict coverage check
        try:
            if not font_has_glyph(fpath, codepoint):
                continue
        except Exception:
            continue

        # load for rendering
        try:
            pil_font = _load_pil_font(fpath, font_size)
        except Exception:
            continue

        return fpath, pil_font

    raise RuntimeError(
        f"No installed priority font contains glyph U+{codepoint:04X}. Tried:\n  " + "\n  ".join(tried)
    )



# Configuration
CANVAS_SIZE = 64
RANGE_START = 0x0000
RANGE_END = 0xABF9
SAMPLES_PER_CHAR = 10
OUTPUT_FILE = "menlo_parallel_dataset.h5"
FONT_PATH = "/System/Library/Fonts/Menlo.ttc"

def render_chunk(codepoints):
    """Worker function to render a list of codepoints."""
    local_images = []
    local_labels = []
    
    # Load font once per worker process
    font_cache = {size: ImageFont.truetype(FONT_PATH, size) for size in range(30, 70)}
    test_font = font_cache[48]

    for cp in codepoints:


        char = ensure_single_codepoint(char)
        cp = ord(char)

        try:
            font_path, font = pick_font_for_codepoint(cp, font_size=48)  # choose size you use for training
        except RuntimeError as e:
            # Decide: either hard fail, or skip + log
            print(f"SKIP {char} U+{cp:04X}: {e}")
            continue

        # Optional extra strictness: confirm Pillow isn't rendering empty
        if font.getmask(char).getbbox() is None:
            print(f"SKIP {char} U+{cp:04X}: empty render in {font_path}")
            continue

        # Now draw using *this* font
        # draw.text((x, y), char, font=font, fill=...)
        # and (strongly recommended) store font_path in your sample metadata


            
        for _ in range(SAMPLES_PER_CHAR):
            zoom = random.uniform(0.8, 1.2)
            size = int(48 * zoom)
            font = font_cache.get(size, ImageFont.truetype(FONT_PATH, size))

            img = Image.new('L', (CANVAS_SIZE, CANVAS_SIZE), 0)
            draw = ImageDraw.Draw(img)
            bbox = draw.textbbox((0, 0), char, font=font)
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            
            pan_x = random.uniform(-0.15, 0.15) * CANVAS_SIZE
            pan_y = random.uniform(-0.15, 0.15) * CANVAS_SIZE
            
            draw.text(((CANVAS_SIZE-w)/2 - bbox[0] + pan_x, 
                       (CANVAS_SIZE-h)/2 - bbox[1] + pan_y), 
                      char, font=font, fill=255)
            
            local_images.append(np.array(img, dtype='uint8'))
            local_labels.append(cp)
            
    return local_images, local_labels

def main():
    # 1. Prepare ranges for workers
    all_codepoints = list(range(RANGE_START, RANGE_END + 1))
    num_cores = mp.cpu_count()
    chunk_size = len(all_codepoints) // num_cores
    chunks = [all_codepoints[i:i + chunk_size] for i in range(0, len(all_codepoints), chunk_size)]

    print(f"Launching {num_cores} workers on M4...")

    # 2. Parallel Rendering
    with mp.Pool(processes=num_cores) as pool:
        results = pool.map(render_chunk, chunks)

    # 3. Aggregate and Write to HDF5
    print("Consolidating data and writing to HDF5...")
    with h5py.File(OUTPUT_FILE, 'w') as hf:
        # Flatten results
        final_images = [img for res in results for img in res[0]]
        final_labels = [lbl for res in results for lbl in res[1]]
        
        hf.create_dataset("images", data=np.array(final_images), compression="gzip", chunks=True)
        hf.create_dataset("labels", data=np.array(final_labels), compression="gzip")

    print(f"Done! Created {len(final_labels)} samples.")

if __name__ == "__main__":
    main()