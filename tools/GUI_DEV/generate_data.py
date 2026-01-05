v0.1

import h5py
import numpy as np
import random
import multiprocessing as mp
from PIL import Image, ImageFont, ImageDraw

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
        char = chr(cp)
        # Glyph validation
        if test_font.getmask(char).getbbox() is None:
            continue
            
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