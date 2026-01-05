#!/usr/bin/env python3
import argparse
import os
import math
import h5py
import numpy as np
from PIL import Image
import multiprocessing as mp

version = "0.5"


# ---------- Image loading / binarization ----------

def load_gray(image_path: str, size: int) -> np.ndarray:
    img = Image.open(image_path).convert("L")
    if img.size != (size, size):
        img = img.resize((size, size), Image.NEAREST)
    return np.array(img, dtype=np.uint8)

def to_bool_ink(arr_u8: np.ndarray, prefer_sparse=True) -> np.ndarray:
    white_ink = arr_u8 > 128
    black_ink = arr_u8 < 128
    if not prefer_sparse:
        return black_ink
    return black_ink if black_ink.sum() <= white_ink.sum() else white_ink

def dilate3x3(x: np.ndarray) -> np.ndarray:
    p = np.pad(x, 1, mode="constant", constant_values=False)
    return (
        p[0:-2,0:-2] | p[0:-2,1:-1] | p[0:-2,2:] |
        p[1:-1,0:-2] | p[1:-1,1:-1] | p[1:-1,2:] |
        p[2:,0:-2]   | p[2:,1:-1]   | p[2:,2:]
    )


# ---------- IoU primitives (no wrap) ----------

def iou_from_crops(A: np.ndarray, B: np.ndarray) -> float:
    inter = np.logical_and(A, B).sum()
    union = np.logical_or(A, B).sum()
    return (inter / union) if union else 0.0

def crop_for_shift(h: int, w: int, dx: int, dy: int):
    ax0 = max(0, dx); ax1 = min(w, w + dx)
    bx0 = max(0, -dx); bx1 = min(w, w - dx)
    ay0 = max(0, dy); ay1 = min(h, h + dy)
    by0 = max(0, -dy); by1 = min(h, h - dy)
    return (slice(ay0, ay1), slice(ax0, ax1), slice(by0, by1), slice(bx0, bx1))

def best_iou_over_shifts(template: np.ndarray, query: np.ndarray, crops) -> float:
    best = 0.0
    for (as_y, as_x, bs_y, bs_x) in crops:
        s = iou_from_crops(template[as_y, as_x], query[bs_y, bs_x])
        if s > best:
            best = s
    return best

def precompute_shift_crops(size: int, radius: int):
    crops = []
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            crops.append(crop_for_shift(size, size, dx, dy))
    return crops


# ---------- Stage A: downsample + cheap score ----------

def downsample_bool_nearest(x: np.ndarray, out_size: int) -> np.ndarray:
    # x: (64,64) bool
    # nearest pick indices
    in_size = x.shape[0]
    if in_size == out_size:
        return x
    idx = (np.linspace(0, in_size - 1, out_size)).round().astype(int)
    return x[np.ix_(idx, idx)]

def stageA_score_templates(images_u8: np.ndarray, query_bool: np.ndarray, stageA_size: int) -> np.ndarray:
    # Try both polarities and take max (robust to inversion)
    t_white = images_u8 > 128
    t_black = images_u8 < 128

    q_small = downsample_bool_nearest(query_bool, stageA_size)

    # Downsample templates
    # (Vectorized over N by indexing; still copies, but small.)
    idx = (np.linspace(0, 63, stageA_size)).round().astype(int)
    tW_small = t_white[:, idx][:, :, idx]
    tB_small = t_black[:, idx][:, :, idx]

    # IoU at zero shift (fast)
    interW = np.logical_and(tW_small, q_small).sum(axis=(1,2))
    unionW = np.logical_or(tW_small, q_small).sum(axis=(1,2))
    sW = np.divide(interW, unionW, out=np.zeros_like(interW, dtype=float), where=unionW != 0)

    interB = np.logical_and(tB_small, q_small).sum(axis=(1,2))
    unionB = np.logical_or(tB_small, q_small).sum(axis=(1,2))
    sB = np.divide(interB, unionB, out=np.zeros_like(interB, dtype=float), where=unionB != 0)

    return np.maximum(sW, sB)


# ---------- Stage B worker (multiprocessing) ----------

def _worker_stageB(args):
    images_u8_chunk, labels_chunk, query_bool, crops, density_prefilter = args

    t_white = images_u8_chunk > 128
    t_black = images_u8_chunk < 128

    dq = int(query_bool.sum())
    dq_f = float(dq) if dq else 0.0

    best_score = {}
    best_index = {}

    for i in range(images_u8_chunk.shape[0]):
        cp = int(labels_chunk[i])

        if density_prefilter and dq:
            dt = min(int(t_white[i].sum()), int(t_black[i].sum()))
            if dt == 0:
                continue
            ratio = max(dq_f / dt, dt / dq_f)
            if ratio > density_prefilter:
                continue

        s1 = best_iou_over_shifts(t_white[i], query_bool, crops)
        s2 = best_iou_over_shifts(t_black[i], query_bool, crops)
        s = s1 if s1 >= s2 else s2

        prev = best_score.get(cp)
        if (prev is None) or (s > prev):
            best_score[cp] = s
            best_index[cp] = i

    return best_score, best_index


# ---------- Main scoring ----------

def score_dataset(
    query_path: str,
    h5_path: str,
    top_n: int = 64,
    stageA_size: int = 16,
    stageA_topk: int = 2000,
    stageB_radius: int = 3,
    dilate: bool = False,
    density_prefilter: float = 2.5,
    workers: int = 0,
    no_multiprocessing: bool = False
):
    # Load query at 64
    q_gray = load_gray(query_path, 64)
    q_bool = to_bool_ink(q_gray, prefer_sparse=True)
    if dilate:
        q_bool = dilate3x3(q_bool)

    # Load dataset (as uint8)
    with h5py.File(h5_path, "r") as hf:
        images = hf["images"][:]   # (N,64,64) uint8
        labels = hf["labels"][:]   # (N,) int

    N = images.shape[0]

    # ----- Stage A -----
    sA = stageA_score_templates(images, q_bool, stageA_size)

    # shortlist indices (top stageA_topk templates)
    k = min(stageA_topk, N)
    shortlist = np.argpartition(sA, -k)[-k:]
    # sort shortlist descending by stageA score (nice for debug)
    shortlist = shortlist[np.argsort(sA[shortlist])[::-1]]

    images_s = images[shortlist]
    labels_s = labels[shortlist]

    # ----- Stage B -----
    crops = precompute_shift_crops(64, stageB_radius)

    # Split into chunks for workers
    if workers <= 0:
        workers = max(1, mp.cpu_count() - 1)

    if no_multiprocessing or workers == 1 or images_s.shape[0] < 2000:
        best_score = {}
        best_index = {}
        r = _worker_stageB((images_s, labels_s, q_bool, crops, density_prefilter))
        best_score, best_index = r
    else:
        chunks = np.array_split(np.arange(images_s.shape[0]), workers)
        jobs = []
        for ch in chunks:
            if ch.size == 0:
                continue
            jobs.append((
                images_s[ch],
                labels_s[ch],
                q_bool,
                crops,
                density_prefilter
            ))

        with mp.Pool(processes=len(jobs)) as pool:
            results = pool.map(_worker_stageB, jobs)

        # Merge best-per-label across workers
        best_score = {}
        best_index = {}
        for bs, bi in results:
            for cp, sc in bs.items():
                prev = best_score.get(cp)
                if (prev is None) or (sc > prev):
                    best_score[cp] = sc
                    best_index[cp] = bi[cp]

    ranked = sorted(best_score.items(), key=lambda kv: kv[1], reverse=True)[:top_n]

    print(f"Rank  Char   Hex Code   Match % (IoU)   v{version}")
    print(f"StageA: {stageA_size}x{stageA_size}, topk={k}   StageB: radius={stageB_radius}, dilate={dilate}, workers={workers}")
    print("-" * 80)
    for r, (cp, s) in enumerate(ranked, start=1):
        ch = chr(cp)
        ch_disp = ch if ch.isprintable() else " "
        print(f"{r:<5} {ch_disp:<6} U+{cp:04X}     {s*100:>7.2f}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("filename", help="Query BMP/PNG/etc")
    ap.add_argument("--dataset", default="menlo_parallel_dataset.h5")
    ap.add_argument("--top", type=int, default=64)

    ap.add_argument("--stageA-size", type=int, default=16, help="downsample size for stage A (default 16)")
    ap.add_argument("--stageA-topk", type=int, default=2000, help="templates to refine in stage B (default 2000)")
    ap.add_argument("--stageB-radius", type=int, default=3, help="shift radius for stage B (default 3)")

    ap.add_argument("--dilate", action="store_true", help="dilate query by 1px before scoring")
    ap.add_argument("--density-prefilter", type=float, default=2.5, help="0 disables")

    ap.add_argument("--workers", type=int, default=0, help="processes for stage B (0 auto)")
    ap.add_argument("--no-multiprocessing", action="store_true")

    args = ap.parse_args()

    score_dataset(
        args.filename,
        args.dataset,
        top_n=args.top,
        stageA_size=args.stageA_size,
        stageA_topk=args.stageA_topk,
        stageB_radius=args.stageB_radius,
        dilate=args.dilate,
        density_prefilter=args.density_prefilter,
        workers=args.workers,
        no_multiprocessing=args.no_multiprocessing
    )


if __name__ == "__main__":
    main()
