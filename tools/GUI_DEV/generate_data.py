# v0.2-fixed (strict fallback + correct rendering)

import os
import random
import multiprocessing as mp
from functools import lru_cache
from typing import Optional, List, Tuple, Dict

import h5py
import numpy as np
import freetype
from PIL import Image, ImageFont, ImageDraw


# ---------------- macOS font search (priority list) ----------------

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


def find_font_file(filename: str) -> Optional[str]:
    for d in MAC_FONT_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    return None


@lru_cache(maxsize=32768)
def _glyph_index(font_path: str, codepoint: int) -> int:
    face = freetype.Face(font_path)
    try:
        face.select_charmap(freetype.FT_ENCODING_UNICODE)
    except Exception:
        pass
    return face.get_char_index(codepoint)


def font_has_glyph(font_path: str, codepoint: int) -> bool:
    return _glyph_index(font_path, codepoint) != 0


def pick_font_for_codepoint(codepoint: int, font_size: int) -> Tuple[str, ImageFont.FreeTypeFont]:
    """
    Pick the first priority font that truly contains the glyph.
    Also ensures Pillow produces non-empty ink for the char.
    """
    ch = chr(codepoint)
    tried: List[str] = []

    for fname in PRIORITY_FONT_FILES:
        fpath = find_font_file(fname)
        if not fpath:
            continue
        tried.append(fpath)

        try:
            if not font_has_glyph(fpath, codepoint):
                continue
        except Exception:
            continue

        try:
            pil_font = ImageFont.truetype(fpath, font_size)
        except Exception:
            continue

        # sanity: reject fonts that render empty for this char
        try:
            if pil_font.getmask(ch).getbbox() is None:
                continue
        except Exception:
            continue

        return fpath, pil_font

    raise RuntimeError(
        f"No installed priority font contains glyph U+{codepoint:04X}. Tried:\n  " + "\n  ".join(tried)
    )


# ---------------- Configuration ----------------

CANVAS_SIZE = 64
RANGE_START = 0x0000
RANGE_END = 0xABF9
SAMPLES_PER_CHAR = 10
OUTPUT_FILE = "menlo_parallel_dataset.h5"

BASE_FONT_SIZE = 48
MIN_FONT_SIZE = 30
MAX_FONT_SIZE = 70

PAN_FRAC = 0.20          # was 0.15
MORPH_PROB = 0.20        # 20% of samples



# ---------------- Helpers -------------------------


def binarize_u8(img_u8: np.ndarray, thr: int = 128) -> np.ndarray:
    return img_u8 > thr

def dilate3x3(x: np.ndarray) -> np.ndarray:
    p = np.pad(x, 1, mode="constant", constant_values=False)
    return (
        p[0:-2,0:-2] | p[0:-2,1:-1] | p[0:-2,2:] |
        p[1:-1,0:-2] | p[1:-1,1:-1] | p[1:-1,2:] |
        p[2:,0:-2]   | p[2:,1:-1]   | p[2:,2:]
    )

def erode3x3(x: np.ndarray) -> np.ndarray:
    p = np.pad(x, 1, mode="constant", constant_values=False)
    return (
        p[0:-2,0:-2] & p[0:-2,1:-1] & p[0:-2,2:] &
        p[1:-1,0:-2] & p[1:-1,1:-1] & p[1:-1,2:] &
        p[2:,0:-2]   & p[2:,1:-1]   & p[2:,2:]
    )

def maybe_morph(img_u8: np.ndarray) -> np.ndarray:
    # img_u8: uint8 0..255
    if random.random() >= MORPH_PROB:
        return img_u8

    x = binarize_u8(img_u8)
    if random.random() < 0.5:
        y = dilate3x3(x)
    else:
        y = erode3x3(x)

    return (y.astype(np.uint8) * 255)



# ---------------- Worker rendering ----------------

def render_chunk(codepoints: List[int]):
    local_images: List[np.ndarray] = []
    local_labels: List[int] = []

    # Cache fonts per worker: (font_path, size) -> ImageFont
    font_cache: Dict[Tuple[str, int], ImageFont.FreeTypeFont] = {}

    for cp in codepoints:
        # skip surrogate codepoints (invalid standalone)
        if 0xD800 <= cp <= 0xDFFF:
            continue

        char = chr(cp)

        # Pick a font that actually supports this glyph
        try:
            font_path, _ = pick_font_for_codepoint(cp, font_size=BASE_FONT_SIZE)
        except RuntimeError:
            # no supported font in your priority list => skip
            continue

        # Generate multiple jittered samples
        for _ in range(SAMPLES_PER_CHAR):
            zoom = random.uniform(0.8, 1.2)
            size = int(BASE_FONT_SIZE * zoom)
            size = max(MIN_FONT_SIZE, min(MAX_FONT_SIZE, size))

            key = (font_path, size)
            font = font_cache.get(key)
            if font is None:
                font = ImageFont.truetype(font_path, size)
                font_cache[key] = font

            img = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), 0)
            draw = ImageDraw.Draw(img)

            bbox = draw.textbbox((0, 0), char, font=font)
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]

            pan_x = random.uniform(-PAN_FRAC, PAN_FRAC) * CANVAS_SIZE
            pan_y = random.uniform(-PAN_FRAC, PAN_FRAC) * CANVAS_SIZE

            draw.text(
                ((CANVAS_SIZE - w) / 2 - bbox[0] + pan_x,
                 (CANVAS_SIZE - h) / 2 - bbox[1] + pan_y),
                char,
                font=font,
                fill=255
            )

            arr = np.array(img, dtype="uint8")
            arr = maybe_morph(arr)
            local_images.append(arr)

            local_images.append(np.array(img, dtype="uint8"))
            local_labels.append(cp)

    return local_images, local_labels


def main():
    all_codepoints = list(range(RANGE_START, RANGE_END + 1))

    num_cores = mp.cpu_count()
    chunk_size = max(1, len(all_codepoints) // num_cores)
    chunks = [all_codepoints[i:i + chunk_size] for i in range(0, len(all_codepoints), chunk_size)]

    print(f"Launching {len(chunks)} chunks across {num_cores} cores...")

    with mp.Pool(processes=num_cores) as pool:
        results = pool.map(render_chunk, chunks)

    print("Consolidating data and writing to HDF5...")

    final_images = [img for res in results for img in res[0]]
    final_labels = [lbl for res in results for lbl in res[1]]

    with h5py.File(OUTPUT_FILE, "w") as hf:
        hf.create_dataset("images", data=np.array(final_images), compression="gzip", chunks=True)
        hf.create_dataset("labels", data=np.array(final_labels), compression="gzip")

    print(f"Done! Created {len(final_labels)} samples.")


if __name__ == "__main__":
    main()
