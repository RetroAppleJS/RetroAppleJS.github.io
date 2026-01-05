import os
import argparse
from PIL import Image, ImageFont, ImageDraw

def find_font(font_name):
    """Searches common macOS font locations for a specific filename."""
    search_paths = [
        os.path.expanduser(f"~/Library/Fonts/{font_name}"),
        f"/Library/Fonts/{font_name}",
        f"/System/Library/Fonts/{font_name}",
        f"/System/Library/Fonts/Supplemental/{font_name}"
    ]
    for path in search_paths:
        if os.path.exists(path):
            return path
    return None

def generate_reference_bmp(character):
    size = 64
    codepoint = ord(character)
    hex_str = f"0x{codepoint:04X}"
    filename = f"char_64x64_{hex_str}.bmp"

    # Define your priority list
    # Added NotoSansMono and the specific macOS font that supports Tifinagh
    font_files = [
        "NotoSansMono-Regular.ttf", 
        "NotoSansTifinagh-Regular.otf",
        "Menlo.ttc",
        "EuphemiaCAS.ttc",  # This is the "Supplemental" one for Tifinagh (⵰)
        "Arial Unicode.ttf"
    ]

    selected_font = None
    for f_name in font_files:
        path = find_font(f_name)
        if path:
            try:
                f = ImageFont.truetype(path, 48)
                # Check if glyph is actually in this font
                if f.getmask(character).getbbox() is not None:
                    selected_font = f
                    print(f"Success! Using: {path}")
                    break
            except:
                continue

    if not selected_font:
        print(f"Warning: Character {hex_str} not found. Ensure you have Noto Sans Tifinagh installed.")
        selected_font = ImageFont.load_default()

    # Render
    img = Image.new('1', (size, size), 0)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), character, font=selected_font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]

    draw.text((x, y), character, font=selected_font, fill=1)
    img.save(filename)
    print(f"File saved: {filename}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("char")
    args = parser.parse_args()
    generate_reference_bmp(args.char)