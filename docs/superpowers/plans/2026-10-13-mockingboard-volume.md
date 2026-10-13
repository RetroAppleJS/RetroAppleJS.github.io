# Mockingboard volume implementation plan

Spec: ../specs/2026-10-13-mockingboard-volume-design.md. Implement inline in the isolated scratch checkout.

1. Add failing renderer calibration, master-gain and toolbox-row tests. Establish current baseline and repair stale clock-dependent test deadlines.
2. Change voice adapter mix gain from 0.5 to 2.0 and preserve floating-point headroom in the stereo pre-mix.
3. Add card-owned percentage and a sink volume API that applies a 10 ms smooth gain transition; synchronize attachment without resetting audio/chip state.
4. Build two toolbox rows and a Disk-II-style cycling master-volume button beside telemetry, with accessible current-level labels.
5. Run complete tests and syntax/patch checks, request one independent review, fix reproduced important findings, and save a base-pinned patch plus updated-file ZIP.
