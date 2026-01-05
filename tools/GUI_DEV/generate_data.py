#v0.2

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
