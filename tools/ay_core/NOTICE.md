# AY core attribution

The numerical implementation follows the existing `res/ayumi.js` in this project, credited to Peter Sovietov and Alexander Kovalenko. This scalar C port retains its DAC tables, interpolation, FIR operations and DC filter; it introduces the packed-event ABI, fixed-memory instance management and snapshots.

Upstream Ayumi is maintained at https://github.com/true-grue/ayumi. Its MIT license is retained verbatim in `AYUMI_LICENSE.txt` (upstream license blob `25371edc627da0ffebecf3c720ebbe5b21a93076`). Project-specific work remains under the repository's `LICENSE.md`.
