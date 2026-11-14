# LIRON SmartPort media: track-wise compression

RetroAppleJS stores HD20 and UniDisk 3.5 images as independent tracks in browser RAM,
using the existing **pako** DEFLATE implementation. The SmartPort bus still receives
and writes ordinary **512-byte logical blocks**, in their original ProDOS order.
No guest software, disk image conversion, ROM or peripheral configuration changes.

## Chunk geometry

| Device | Logical size | Track definition | Tracks | Maximum decompressed cache |
| --- | ---: | --- | ---: | ---: |
| HD20 | 20,971,520 bytes (20 MiB) | 16 sectors (8 KiB) per **logical** track, matching the HD20 surface-map cells | 2,560 | 8,192 bytes |
| UniDisk 3.5 | 819,200 bytes (800 KiB) | One physical 3.5-inch track **per side**, using 12, 11, 10, 9 or 8 sectors in five 16-cylinder zones | 160 | 6,144 bytes |

**Important:** The HD20 has no actual rotating-track geometry exposed to
SmartPort. Here *logical track* means one contiguous 8 KiB grouping. The UniDisk
track boundaries follow its real zone-dependent sector count: side 0 and then
side 1 of each cylinder, with both sides stored independently.

## In-memory representation

Each track is either:

- **Implicit zero**: no sector payload at all, represented by a null track slot.
- **Compressed**: pako `deflateRaw` at level 1, only when the result is
  *smaller* than the original track.
- **Raw**: the track's original bytes, only for incompressible data.

Each device keeps only one decompressed, mutable track in a synchronous cache.
A SmartPort READBLOCK returns a separate 512-byte copy. HD20 WRITEBLOCK updates
the cached track; on switching tracks, the modified track is recompressed and
its exact nonzero-byte count and byte sum are recalculated. No uncompressed
whole-disk mirror remains after import.

When pako is absent, the shared helper retains independent raw track records
instead of attempting unsupported compression. Standalone device environments
without the helper retain the original plain typed-array fallback.

The HD20 surface-map density is derived from the per-track statistics without
decompressing all 2,560 cells. The ProDOS volume label is also cached and
updated on image load, block 2 modification, and format, avoiding needless
eviction of the current SmartPort track during UI refreshes.

## RAM behavior and limits

The nominal storage for an *all-zero* 20 MiB HD20 is **zero compressed track
payload bytes**, plus the track directory, density metadata and up to 8 KiB
of cache. The track directory and JavaScript object overhead still consume
memory; zero stored bytes does **not** mean zero browser RAM.

An 800 KiB UniDisk behaves similarly, with at most one 6 KiB track in cache.
Actual savings depend on image entropy. An incompressible image may require
nearly its original size, and pako itself requires temporary working memory.

**Import peak:** The current HTTP/FileReader and gzip decoding pipeline still
creates a temporary 20 MiB uncompressed image. The media store compresses it
track by track and does **not** retain it. A separate streaming import stage
would be needed to lower *peak* RAM during loading.

**Export peak:** Calling `device.getImage()` deliberately constructs a full
uncompressed `.po` image for download. This is not the backing store, and
releasing the returned array allows it to be garbage-collected.

`device.getState().mediaBytes` continues to report the logical capacity, while
`device.getState().mediaStorage` exposes the track store's:

- `mode`: `pako-raw-deflate` or `raw`
- `logicalBytes`, `storedBytes`, `cacheBytes`
- `trackCount`, `compressedTracks`, `rawTracks`, `zeroTracks`

The `storedBytes` field accounts for retained media payloads, **not** array,
JavaScript object, cache or pako runtime overhead.

## Compatibility and testing

The implementation preserves device block counts, status and error codes,
read-only UniDisk behavior, HD20 writable/format semantics, volume names,
surface maps, `loadImage()` and `getImage()` contracts, and SmartPort device
detach/release behavior.

```sh
node --test tests/liron_track_compressed_media.test.js
```

This suite uses **the repository's actual `res/pako.min.js` library**, testing
random HD20 and UniDisk sector reads, HD20 writes and cache eviction,
large image exports, zone boundaries, compression savings, incompressible
fallback, transactional import failure, format/eject, and volume-name updates.
The dedicated GitHub Actions workflow runs the same tests on every relevant PR.

For complete integration, additionally boot LIRON with a ProDOS image and
verify SmartPort READBLOCK, HD20 WRITEBLOCK, disk surface-map rendering,
and image download in the browser.
