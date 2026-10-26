#!/usr/bin/env python3
"""Independent, limited NMOS 6502 + VIA instruction execution for MB-05.
NOT RetroAppleJS or real-device data. Acceptance must use real emulator telemetry.
"""
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CPU:
    def __init__(self):
        self.m=bytearray(65536)
        b=(ROOT/'build/AY_SCORE_TIMING_MB05.bin').read_bytes();self.m[0x6000:0x6000+len(b)]=b
        self.m[0x3fe:0x400]=b'\x00\xff'
        self.pc=0x6000; self.sp=0xfd;self.a=self.x=self.y=0;self.p=0x20
        # simulated JSR to $6000 from monitor (RTS to $F001)
        self.push(0xF0);self.push(0x00)
        self.t=0;self.t1=0xffff;self.t1l=0xffff;self.t1running=False;self.t1gap=False;self.acr=0;self.ier=0;self.ifr=0;self.ddra=0;self.ddrb=0;self.t1underflows=0;self.lost_irqs=0
        self.t2=0xffff;self.t2running=False;self.t2phase=0;self.t2initial=0xffff
        self.ay_reg=0;self.ay_ctrl=0;self.ay_valid=False;self.ora=0;self.orb=0;self.writes=[];self.irqs=0;self.insts=0
        self.directions=(0,0);self.irqHoldWindows=[]
    def push(self,b):self.m[0x100+self.sp]=b&255;self.sp=(self.sp-1)&255
    def pop(self):self.sp=(self.sp+1)&255;return self.m[0x100+self.sp]
    def flag(self,bit,on):self.p=(self.p|bit) if on else (self.p&~bit)
    def nz(self,v):self.flag(0x02,(v&255)==0);self.flag(0x80,v&128)
    def tick(self,cycles):
        for _ in range(cycles):
            self.t+=1
            if self.t1gap:
                self.t1=self.t1l;self.t1gap=False
                if self.t1running and self.acr&0x40:
                    self.t1underflows+=1
                    if self.ifr&0x40:self.lost_irqs+=1
                    self.ifr|=0x40
            elif self.t1==0:
                self.t1=0xFFFF;self.t1gap=True
            else:self.t1-=1
            self.t2=(self.t2-1)&65535
    def read(self,addr):
        if addr==0xC40D:return self.ifr| (0x80 if (self.ifr & self.ier)!=0 else 0)
        if addr==0xC40E:return self.ier|0x80
        if addr==0xC40B:return self.acr
        if addr==0xC402:return self.ddrb
        if addr==0xC403:return self.ddra
        if addr==0xC404:self.ifr&=~0x40;return self.t1&255
        if addr==0xC405:return self.t1>>8
        if addr==0xC408:return self.t2&255
        if addr==0xC409:return self.t2>>8
        return self.m[addr]
    def write(self,addr,v):
        v&=255
        if addr==0xC40E:
            if v&128:self.ier|=v&127
            else:self.ier&=~v
        elif addr==0xC40B:self.acr=v
        elif addr==0xC402:self.ddrb=v
        elif addr==0xC403:self.ddra=v
        elif addr==0xC404:self.t1l=(self.t1l&0xFF00)|v
        elif addr==0xC405:
            self.t1l=(v<<8)|(self.t1l&255);self.t1=self.t1l;self.t1gap=False;self.t1running=True;self.ifr&=~0x40
        elif addr==0xC408:self.t2initial=(self.t2initial&0xFF00)|v
        elif addr==0xC409:self.t2=(v<<8)|(self.t2initial&255)
        elif addr==0xC401:self.ora=v
        elif addr==0xC400:
            old=self.ay_ctrl;self.orb=v
            mode={4:0,5:1,6:2,7:3}.get(v&7,-1)
            if old==0:
                if mode==3:self.ay_reg=self.ora;self.ay_valid=True
                if mode==2 and self.ay_valid:self.writes.append((self.t,self.ay_reg,self.ora))
            self.ay_ctrl=mode
        else:self.m[addr]=v
    def take_irq(self):
        self.irqs+=1
        if self.irqs>800:raise RuntimeError('IRQ storm')
        self.push(self.pc>>8);self.push(self.pc&255);self.push(self.p&~0x10)
        self.flag(0x04,True)
        self.tick(7)
        # Approximate monitor saving A to ZP $45 and dispatching $03FE.
        self.m[0x45]=self.a
        self.tick(44)
        self.pc=self.m[0x3fe]|self.m[0x3ff]<<8
    def step(self):
        if self.ier&self.ifr&0x40 and not self.p&4 and not any(a<=self.t<b for a,b in self.irqHoldWindows):self.take_irq()
        pc=self.pc;op=self.m[pc];self.pc=(pc+1)&65535;self.insts+=1
        def imm():
            r=self.m[self.pc];self.pc=(self.pc+1)&65535;return r
        def addr():
            a=imm();return a|(imm()<<8)
        def set_a(v):self.a=v&255;self.nz(self.a)
        def branch(ok):
            disp=imm();d=disp if disp<128 else disp-256
            if ok:
                dest=(self.pc+d)&65535;self.tick(3+(1 if (self.pc^dest)&0xff00 else 0));self.pc=dest
            else:self.tick(2)
        if op==0x4c:self.pc=addr();self.tick(3)
        elif op==0x6c:
            a=addr();self.pc=self.read(a)|self.read((a&0xff00)|((a+1)&255))<<8;self.tick(5)
        elif op==0x20:
            a=addr();ret=(self.pc-1)&65535;self.push(ret>>8);self.push(ret&255);self.pc=a;self.tick(6)
        elif op==0x60:self.pc=(self.pop()|(self.pop()<<8))+1;self.tick(6)
        elif op==0x40:self.p=self.pop();self.pc=self.pop()|(self.pop()<<8);self.tick(6)
        elif op==0xa9:set_a(imm());self.tick(2)
        elif op==0xad:set_a(self.read(addr()));self.tick(4)
        elif op==0xbd:
            a=addr();z=a+self.x;set_a(self.read(z&65535));self.tick(4+(1 if (a^z)&0xff00 else 0))
        elif op==0xb9:
            a=addr();z=a+self.y;set_a(self.read(z&65535));self.tick(4+(1 if (a^z)&0xff00 else 0))
        elif op==0xa2:self.x=imm();self.nz(self.x);self.tick(2)
        elif op==0xae:self.x=self.read(addr());self.nz(self.x);self.tick(4)
        elif op==0xa0:self.y=imm();self.nz(self.y);self.tick(2)
        elif op==0xac:self.y=self.read(addr());self.nz(self.y);self.tick(4)
        elif op==0x8d:
            a=addr();self.write(a,self.a);self.tick(4)
        elif op==0x9d:
            a=addr();self.write((a+self.x)&65535,self.a);self.tick(5)
        elif op==0x8c:
            a=addr();self.write(a,self.y);self.tick(4)
        elif op==0xee:
            a=addr();v=(self.read(a)+1)&255;self.write(a,v);self.nz(v);self.tick(6)
        elif op==0xe8:self.x=(self.x+1)&255;self.nz(self.x);self.tick(2)
        elif op==0xc8:self.y=(self.y+1)&255;self.nz(self.y);self.tick(2)
        elif op==0xca:self.x=(self.x-1)&255;self.nz(self.x);self.tick(2)
        elif op==0x8a:set_a(self.x);self.tick(2)
        elif op==0x98:set_a(self.y);self.tick(2)
        elif op==0xaa:self.x=self.a;self.nz(self.x);self.tick(2)
        elif op==0xa8:self.y=self.a;self.nz(self.y);self.tick(2)
        elif op==0x49:set_a(self.a^imm());self.tick(2)
        elif op==0x29:set_a(self.a&imm());self.tick(2)
        elif op==0x4a:
            x=self.a; self.flag(1,bool(x&1));set_a(x>>1);self.tick(2)
        elif op==0x6d:
            x=self.a+self.read(addr())+(self.p&1);self.flag(1,x>255);set_a(x);self.tick(4)
        elif op==0xed:
            x=self.a-self.read(addr())-(0 if self.p&1 else 1);self.flag(1,x>=0);set_a(x);self.tick(4)
        elif op==0xcd:
            v=self.read(addr());x=self.a-v;self.flag(1,x>=0);self.nz(x&255);self.tick(4)
        elif op==0xc9:
            v=imm();x=self.a-v;self.flag(1,x>=0);self.nz(x&255);self.tick(2)
        elif op==0xc0:
            v=imm();x=self.y-v;self.flag(1,x>=0);self.nz(x&255);self.tick(2)
        elif op==0x18:self.flag(1,False);self.tick(2)
        elif op==0x38:self.flag(1,True);self.tick(2)
        elif op==0x08:self.push(self.p|0x30);self.tick(3)
        elif op==0x28:self.p=self.pop();self.tick(4)
        elif op==0x48:self.push(self.a);self.tick(3)
        elif op==0x68:set_a(self.pop());self.tick(4)
        elif op==0x78:self.flag(4,True);self.tick(2)
        elif op==0x58:self.flag(4,False);self.tick(2)
        elif op==0xea:self.tick(2)
        elif op==0xf0:branch(bool(self.p&2))
        elif op==0xd0:branch(not (self.p&2))
        elif op==0x90:branch(not (self.p&1))
        elif op==0xb0:branch(bool(self.p&1))
        else:raise RuntimeError(f'Unsupported op ${op:02X} at ${pc:04X} time {self.t} inst {self.insts}')
    def run(self):
        for i in range(1_000_000):
            if self.pc==0xF001:return
            self.step()
        raise RuntimeError(f'Stuck PC ${self.pc:04X}, IRQs {self.irqs}, current IRQ {self.m[0x6f01]}, event {self.m[0x6f02]}, tick {self.m[0x6f03]}, due {self.m[0x6f04]}, mode {self.m[0x6f00]}, timer i/e {self.ifr:02X}/{self.ier:02X}, missed {self.lost_irqs}')

if __name__=='__main__':
    cpu=CPU();cpu.run();print('INDEPENDENT LIMITED SIMULATION — NOT ACTUAL RETROAPPLEJS:')
    for k in range(3):
        p=0x6F40+16*k
        fields=list(cpu.m[p:p+12]); data={'mode':fields[1], 'magic':fields[0], 'irqs':fields[2], 'e1Events':fields[3], 'hgrWrites':fields[4]|fields[5]<<8,'elapsedT2':fields[6]|fields[7]<<8,'lateTickEvents':fields[8],'maxLateTicks':fields[9],'streamBytes':fields[10],'error':fields[11]}
        interior=[]
        for j in range(data['irqs']):
            entering=cpu.m[0x6800+k*128+j] | (cpu.m[0x6c00+k*128+j]<<8)
            exiting=cpu.m[0x6a00+k*128+j] | (cpu.m[0x6d80+k*128+j]<<8)
            interior.append((entering-exiting)&65535)
        data['interiorMeasuredT2Cycles']={'min':min(interior),'max':max(interior),'avg':round(sum(interior)/len(interior),2)}
        spans=list(cpu.m[0x7000+64*k+1:0x7000+64*k+64])
        data['decodeSpanCycles']={'min':min(spans),'max':max(spans),'avg':round(sum(spans)/len(spans),2)}
        print(data)
    from collections import Counter
    print('AY writes',len(cpu.writes),Counter(r for t,r,v in cpu.writes),'total cycles',cpu.t,'interrupts',cpu.irqs,'t1Underflows',cpu.t1underflows,'unservicedUnderflows',cpu.lost_irqs,'instructions',cpu.insts)
    prev=0
    e=[]
    for t,reg,v in cpu.writes:
        e.append([t-prev,0,reg,v]);prev=t
    (ROOT/'tests/SIMULATED_MOCKINGBOARD_HISTORY_MB05.json').write_text(json.dumps({'format':'RetroAppleJS.MockingboardHistory','version':1,'slot':5,'clockHz':1021800,'baseTick':0,'wrapped':False,'provenance':'Synthetic CPU/VIA simulation, NOT actual RetroAppleJS history','events':e},indent=2)+'\n')
    records=[]
    for k in range(3):
        r=list(cpu.m[0x6F40+k*16:0x6F40+k*16+12]);records.append(r)
        assert r[0]==0xA5 and r[1]==k+1 and r[3]==64 and r[2]==48 and r[10]==232 and r[11]==0,(k,r)
    assert len(cpu.writes)==140, len(cpu.writes)
    assert not cpu.lost_irqs, 'IRQ lost while handler active'
    assert cpu.m[0x3fe]==0 and cpu.m[0x3ff]==0xff, 'IRQ soft vector not restored'
    assert cpu.m[0x6F11]==0, 'ACTIVE not cleared'
    assert not cpu.ier&0x40, 'Timer IRQ still enabled'
    (ROOT/'tests/SIMULATED_TEST_RESULTS_MB05.json').write_text(json.dumps({'provenance':'Limited Python instruction+VIA simulator, NOT actual RetroAppleJS measurements','records':records,'ayWrites':len(cpu.writes),'irqs':cpu.irqs,'t1Underflows':cpu.t1underflows,'lostIrqSignals':cpu.lost_irqs},indent=2)+'\n')
    print('SIMULATOR CHECKS: PASS')
