#!/usr/bin/env python3
# char_to_bmp.py v0.5 — macOS font fallback + strict missing-glyph detection

import os
import argparse
from typing import Optional, List, Tuple

import freetype
from PIL import Image, ImageFont, ImageDraw


# ---------- Font discovery (macOS common paths) ----------

MAC_FONT_DIRS = [
    os.path.expanduser("~/Library/Fonts"),
    "/Library/Fonts",
    "/System/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
]

# Put your preferred fonts first (filenames). Adjust to taste.
PRIORITY_FONT_FILES = [
    "NotoSansMono-Regular.ttf",
    "NotoSansTifinagh-Regular.otf",
    "Menlo.ttc",
    "EuphemiaCAS.ttc",
    "Arial Unicode.ttf",  # may not exist on newer macOS
]


def find_font_file(filename: str) -> Optional[str]:
    """Return full path if filename exists in common macOS font dirs."""
    for d in MAC_FONT_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    return None


def font_has_glyph(font_path: str, codepoint: int) -> bool:
    """
    True if font contains glyph for codepoint (FreeType char index != 0).
    This avoids mistaking tofu/.notdef placeholders for real glyph coverage.
    """
    face = freetype.Face(font_path)
    try:
        face.select_charmap(freetype.FT_ENCODING_UNICODE)
    except Exception:
        # Some fonts still work without explicit selection
        pass
    return face.get_char_index(codepoint) != 0


def pick_font_for_char(char: str, codepoint: int, font_size: int) -> Tuple[str, ImageFont.FreeTypeFont]:
    """
    Choose the first font (from priority list) that truly supports the codepoint.
    Returns (font_path, pillow_font). Raises RuntimeError if none found.
    """
    tried: List[str] = []

    for fname in PRIORITY_FONT_FILES:
        fpath = find_font_file(fname)
        if not fpath:
            continue
        tried.append(fpath)

        # 1) strict: does the font contain the glyph?
        try:
            if not font_has_glyph(fpath, codepoint):
                continue
        except Exception:
            # freetype couldn't open it? skip
            continue

        # 2) load via Pillow for actual rendering
        try:
            pil_font = ImageFont.truetype(fpath, font_size)
        except Exception:
            continue

        # 3) optional sanity: ensure it produces some ink for this glyph
        # (Some fonts claim coverage but render empty for edge cases)
        try:
            if pil_font.getmask(char).getbbox() is None:
                continue
        except Exception:
            continue

        return fpath, pil_font

    raise RuntimeError(
        f"No installed font found for U+{codepoint:04X}. Tried:\n  " + "\n  ".join(tried)
    )


# ---------- Bitmap generation ----------

def ensure_single_codepoint(s: str) -> str:
    cps = list(s)
    if len(cps) != 1:
        raise ValueError("Expected exactly one Unicode code point (one character).")
    return cps[0]


def render_char_to_1bit_bmp(char: str, font: ImageFont.FreeTypeFont, size: int, out_path: str) -> None:
    # 1-bit image: 0=black, 1=white (we'll invert at the end if you prefer)
    # Using mode "1" is fine for BMP; Pillow writes 1bpp.
    img = Image.new("1", (size, size), 1)
    draw = ImageDraw.Draw(img)

    # Compute bbox and center it
    bbox = draw.textbbox((0, 0), char, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]

    draw.text((x, y), char, font=font, fill=0)
    img.save(out_path)
    print(f"File saved: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Render one UTF-8 character to a 64x64 1-bit BMP with strict font fallback.")
    parser.add_argument("char", help="single UTF-8 character (one Unicode code point)")
    parser.add_argument("--size", type=int, default=64, help="bitmap width/height (default 64)")
    parser.add_argument("--font-size", type=int, default=48, help="font pixel size used for rendering (default 48)")
    parser.add_argument("--out", default=None, help="output BMP path (default: char_64x64_0xXXXX.bmp)")
    args = parser.parse_args()

    char = ensure_single_codepoint(args.char)
    cp = ord(char)

    out_path = args.out or f"char_{args.size}x{args.size}_0x{cp:04X}.bmp"

    font_path, pil_font = pick_font_for_char(char, cp, args.font_size)
    print(f"Success! Using: {font_path}")

    # Extra strictness: ensure the chosen font still passes glyph test
    if not font_has_glyph(font_path, cp):
        raise RuntimeError(f"Glyph missing in selected font (unexpected): U+{cp:04X} ({font_path})")

    render_char_to_1bit_bmp(char, pil_font, args.size, out_path)


if __name__ == "__main__":
    main()
