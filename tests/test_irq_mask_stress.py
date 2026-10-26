#!/usr/bin/env python3
"""Independent model fault injection: delayed/masked Timer1 IRQ acceptance.
Proves MB05 Timer2-based score clock recognizes whole-256-cycle lateness.
This is NOT a real RetroAppleJS or hardware test.
"""
from simulate_mb05 import CPU
x=CPU()
x.irqHoldWindows=[(4600,7000)]
x.run()
r=list(x.m[0x6F40:0x6F40+12]);
assert r[0]==0xA5 and r[1]==1 and r[3]==64 and r[10]==232 and r[11]==0,r
assert r[2]<48 and r[8]>0 and r[9]>0,r
assert x.m[0x3fe]==0 and x.m[0x3ff]==0xFF
assert not (x.ier&0x40)
print(f'STRESS PASS — synthetic forced IRQ hold, mode A irqs={r[2]}, lateEvents={r[8]}, maxLate256CycleUnits={r[9]}, all 64 events dispatched')
