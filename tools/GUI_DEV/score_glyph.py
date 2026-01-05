# v0.2 - robust foreground detection + dataset presence check

import h5py
import numpy as np
import argparse
from PIL import Image

def load_bin_image(image_path: str) -> np.ndarray:
    img = Image.open(image_path).convert("L")
    if img.size != (64, 64):
        img = img.resize((64, 64), Image.NEAREST)  # NEAREST avoids blur thresholds
    arr = np.array(img, dtype=np.uint8)

    # Two candidates: ink as white (>) or ink as black (<)
    bin_white_ink = arr > 128
    bin_black_ink = arr < 128

    # Heuristic: ink should usually be the *smaller* set (sparser).
    # Choose the binarization with fewer True pixels.
    if bin_black_ink.sum() <= bin_white_ink.sum():
        return bin_black_ink
    return bin_white_ink

def iou_scores(images_bin: np.ndarray, input_bin: np.ndarray) -> np.ndarray:
    inter = np.logical_and(images_bin, input_bin).sum(axis=(1,2))
    union = np.logical_or(images_bin, input_bin).sum(axis=(1,2))
    return np.divide(inter, union, out=np.zeros_like(inter, dtype=float), where=union != 0)

def get_unique_toplist(image_path, h5_path, top_n=64):
    try:
        input_bin = load_bin_image(image_path)

        with h5py.File(h5_path, 'r') as hf:
            images = hf['images'][:]  # uint8 (N,64,64)
            labels = hf['labels'][:]

            # Dataset binarization: treat bright pixels as ink (typical if you drew fill=255 on black)
            # But if your dataset is inverted, this will be wrong. We guard by trying both.
            img_white_ink = images > 128
            img_black_ink = images < 128

            # Score both ways and keep the better score per template.
            scores_a = iou_scores(img_white_ink, input_bin)
            scores_b = iou_scores(img_black_ink, input_bin)
            iou = np.maximum(scores_a, scores_b)

            # Sort by highest IoU
            sorted_indices = np.argsort(iou)[::-1]

            # Unique characters
            unique_results = []
            seen = set()
            for idx in sorted_indices:
                cp = int(labels[idx])
                if cp in seen:
                    continue
                seen.add(cp)
                unique_results.append({
                    "char": chr(cp),
                    "hex": f"U+{cp:04X}",
                    "score": iou[idx] * 100
                })
                if len(unique_results) >= top_n:
                    break

            print(f"{'Rank':<5} {'Char':<6} {'Hex Code':<10} {'Match % (IoU)'}")
            print("-" * 40)
            for i, res in enumerate(unique_results):
                ch = res['char'] if res['char'].isprintable() else " "
                print(f"{i+1:<5} {ch:<6} {res['hex']:<10} {res['score']:>7.2f}%")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("filename")
    parser.add_argument("--dataset", default="menlo_parallel_dataset.h5")
    parser.add_argument("--top", type=int, default=64)
    args = parser.parse_args()
    get_unique_toplist(args.filename, args.dataset, top_n=args.top)
