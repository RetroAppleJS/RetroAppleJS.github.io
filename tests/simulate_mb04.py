#!/usr/bin/env python3
"""Independent, limited NMOS 6502 + VIA instruction execution for MB-04.
NOT RetroAppleJS or real-device data. Acceptance must use real emulator telemetry.
"""
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CPU:
    def __init__(self):
        self.m=bytearray(65536)
        b=(ROOT/'build/AY_SCORE_TIMING_MB04.bin').read_bytes();self.m[0x6000:0x6000+len(b)]=b
        self.m[0x3fe:0x400]=b'\x00\xff'
        self.pc=0x6000; self.sp=0xfd;self.a=self.x=self.y=0;self.p=0x20
        # simulated JSR to $6000 from monitor (RTS to $F001)
        self.push(0xF0);self.push(0x00)
        self.t=0;self.t1=0xffff;self.t1l=0xffff;self.t1running=False;self.t1gap=False;self.acr=0;self.ier=0;self.ifr=0
        self.t2=0xffff;self.t2running=False;self.t2phase=0;self.t2initial=0xffff
        self.ay_reg=0;self.ay_ctrl=0;self.ay_valid=False;self.ora=0;self.orb=0;self.writes=[];self.irqs=0;self.insts=0
        self.directions=(0,0)
    def push(self,b):self.m[0x100+self.sp]=b&255;self.sp=(self.sp-1)&255
    def pop(self):self.sp=(self.sp+1)&255;return self.m[0x100+self.sp]
    def flag(self,bit,on):self.p=(self.p|bit) if on else (self.p&~bit)
    def nz(self,v):self.flag(0x02,(v&255)==0);self.flag(0x80,v&128)
    def tick(self,cycles):
        for _ in range(cycles):
            self.t+=1
            if self.t1gap:
                self.t1=self.t1l;self.t1gap=False
                if self.t1running and self.acr&0x40:self.ifr|=0x40
            elif self.t1==0:
                self.t1=0xFFFF;self.t1gap=True
            else:self.t1-=1
            self.t2=(self.t2-1)&65535
    def read(self,addr):
        if addr==0xC40D:return self.ifr| (0x80 if (self.ifr & self.ier)!=0 else 0)
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
        if self.irqs>300:raise RuntimeError('IRQ storm')
        self.push(self.pc>>8);self.push(self.pc&255);self.push(self.p&~0x10)
        self.flag(0x04,True)
        self.tick(7)
        # Approximate monitor saving A to ZP $45 and dispatching $03FE.
        self.m[0x45]=self.a
        self.tick(20)
        self.pc=self.m[0x3fe]|self.m[0x3ff]<<8
    def step(self):
        if self.ier&self.ifr&0x40 and not self.p&4:self.take_irq()
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
        elif op==0xa2:self.x=imm();self.nz(self.x);self.tick(2)
        elif op==0xae:self.x=self.read(addr());self.nz(self.x);self.tick(4)
        elif op==0xa0:self.y=imm();self.nz(self.y);self.tick(2)
        elif op==0xac:self.y=self.read(addr());self.nz(self.y);self.tick(4)
        elif op==0x8d:
            a=addr();self.write(a,self.a);self.tick(4)
        elif op==0x9d:
            a=addr();self.write((a+self.x)&65535,self.a);self.tick(5)
        elif op==0xee:
            a=addr();v=(self.read(a)+1)&255;self.write(a,v);self.nz(v);self.tick(6)
        elif op==0xe8:self.x=(self.x+1)&255;self.nz(self.x);self.tick(2)
        elif op==0xca:self.x=(self.x-1)&255;self.nz(self.x);self.tick(2)
        elif op==0x8a:set_a(self.x);self.tick(2)
        elif op==0x98:set_a(self.y);self.tick(2)
        elif op==0xaa:self.x=self.a;self.nz(self.x);self.tick(2)
        elif op==0xa8:self.y=self.a;self.nz(self.y);self.tick(2)
        elif op==0x49:set_a(self.a^imm());self.tick(2)
        elif op==0x29:set_a(self.a&imm());self.tick(2)
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
        for i in range(400_000):
            if self.pc==0xF001:return
            self.step()
        raise RuntimeError(f'Stuck PC ${self.pc:04X}, IRQs {self.irqs}, count {self.m[0x6f03]}, mode {self.m[0x6f02]}')

if __name__=='__main__':
    cpu=CPU();cpu.run();print('SIMULATED, not measured RetroAppleJS:')
    for k in range(3):
        p=0x6F10+16*k
        data={'mode':cpu.m[p+1], 'magic':cpu.m[p], 'irqs':cpu.m[p+2], 'hgrWrites':cpu.m[p+3]|cpu.m[p+4]<<8,'timer2cycles':cpu.m[p+5]|cpu.m[p+6]<<8,'error':cpu.m[p+9]}
        a=list(cpu.m[0x6e00+k*64:0x6e40+k*64]);b=list(cpu.m[0x6c00+k*64:0x6c40+k*64]);data['phaseLatenessRange']=[min((254-z)&255 for z in a),max((254-z)&255 for z in a)];data['interiorSampleCycles']=[min((start-end)&255 for start,end in zip(a,b)),max((start-end)&255 for start,end in zip(a,b))]
        print(data)
    from collections import Counter
    print('total AY writes',len(cpu.writes),'by register',Counter(r for t,r,v in cpu.writes),'total simulated cycles',cpu.t,'irq',cpu.irqs,'instructions',cpu.insts)
    prev=0
    e=[]
    for t,reg,v in cpu.writes:
        e.append([t-prev,0,reg,v]);prev=t
    (ROOT/'tests/SIMULATED_MOCKINGBOARD_HISTORY.json').write_text(json.dumps({'format':'RetroAppleJS.MockingboardHistory','version':1,'slot':5,'clockHz':1021800,'baseTick':0,'wrapped':False,'provenance':'Synthetic CPU/VIA simulation, NOT actual RetroAppleJS history','events':e},indent=2)+'\n')
    (ROOT/'tests/SIMULATED_TEST_RESULTS.json').write_text(json.dumps({'provenance':'Limited Python instruction+VIA simulator, not RetroAppleJS measurements','records':[{k:v for k,v in zip(['magic','mode','irqCount','hgrLo','hgrHi','elapsedLo','elapsedHi','latchLo','latchHi','error'],list(cpu.m[0x6F10+16*i:0x6F1A+16*i]))} for i in range(3)],'totalAyWrites':len(cpu.writes)},indent=2)+'\n')
    assert all(cpu.m[0x6F10+i*16]==0xA4 for i in range(3))
    assert all(cpu.m[0x6F12+i*16]==64 for i in range(3))
    assert len(cpu.writes)==137, len(cpu.writes)
    assert all(cpu.m[0x6F19+i*16]==0 for i in range(3))
    assert cpu.m[0x3fe]==0 and cpu.m[0x3ff]==0xff, 'soft IRQ vector not restored'
    assert cpu.m[0x6F0A]==0, 'ACTIVE not cleared'
    assert not (cpu.ier&0x40), 'timer IRQ still enabled'
    print('SIMULATOR CHECKS: PASS')
