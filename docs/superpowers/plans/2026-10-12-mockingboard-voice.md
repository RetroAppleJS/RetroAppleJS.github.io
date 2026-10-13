# Mockingboard voice implementation plan

Spec: ../specs/2026-10-12-mockingboard-voice-design.md
Execution: implement inline in this isolated scratch checkout.

1. Add failing tests around a real AY JS/WASM card rig and voice device contract.
2. Embed the exact tested SSI263 core in EMU_DEVICE_mockingboard_voice.js. Add bounded timestamped render events, logical tick/request handling, transport rebase, per-device PCM rate conversion and lifecycle.
3. Wire the card to the device: primary speech write decoding, VIA1 CA1 edge delivery, CPU progression, mapped rendering into existing stereo PCM, backend epoch changes, reset/unmount and two-device provisioning. Load the new script before the card.
4. Build the two-column popup, live register controls and explicit phoneme audition; combine the toolbox in one row.
5. Run targeted tests, unchanged source PCM parity and the repository test suite. Review once independently; fix important findings with reproducing tests. Package a base-pinned patch and a ZIP of changed files with instructions.
