/*
 * Vaporlock bus regression scenario, NTSC Apple II/II+, JavaScript CPU.
 * Paste this complete file into STEP TRACE SCENARIO and select RUN.
 * BREAK IF: PC >= $6000 && PC <= $62FF
 * Start the injected program with 6000G in the Apple II monitor; use 1000 IPS.
 * The live emulator owns all execution. See VAPORLOCK_STEPTRACE_SCENARIO.md.
 */
(function () {
    'use strict';

    const ENTRY = 0x6000;
    const CONDITION = 'PC >= $6000 && PC <= $62FF';
    const hw = window.apple2plus && window.apple2plus.hwObj();
    function need(ok, text) { if (!ok) throw new Error(text); }
    need(hw && typeof hw.getScannerAddress === 'function' && typeof hw.getVideoMode === 'function'
        && typeof hw.getLastBusAccess === 'function', 'Apply the Vaporlock bus patch first.');
    need(window.STB && typeof STB.onBreakpoint === 'function', 'Open live STEP TRACE SCENARIO.');
    need(cpu.state().cycle_delay === 0, 'Pause at a clean instruction boundary before arming.');
    if (window.VAPORLOCK_STEPTRACE && window.VAPORLOCK_STEPTRACE.cleanup)
        window.VAPORLOCK_STEPTRACE.cleanup();

    const cases = [];
    function add(name, bytes, ticks, options) {
        const c = Object.assign({name:name, bytes:bytes, ticks:ticks}, options || {});
        cases.push(c); return c;
    }
    function lda(name, address, options) {
        return add(name, [0xAD,address & 255,address >> 8], 4,
            Object.assign({operation:'lda',data:[[address,3,'R']]},options || {}));
    }
    function mode(name, address, key, value) {
        return lda(name,address,{change:[key,value]});
    }
    add('SEI',[0x78],2);
    add('CLD',[0xD8],2);
    mode('TEXT / old-mode fetch',0xC051,'gfx',false);
    mode('MIXED off',0xC052,'mix',false);
    mode('PAGE1 / old-page fetch',0xC054,'page2',false);
    mode('LORES latch',0xC056,'hires',false);
    lda('LDA absolute floating bus',0xC020);
    add('CMP absolute floating bus',[0xCD,0x20,0xC0],4,{operation:'cmp',data:[[0xC020,3,'R']]});
    add('BIT absolute floating bus',[0x2C,0x20,0xC0],4,{operation:'bit',data:[[0xC020,3,'R']]});
    add('EOR absolute floating bus',[0x4D,0x20,0xC0],4,{operation:'eor',data:[[0xC020,3,'R']]});
    add('LDX #1',[0xA2,1],2,{reg:['X',1]});
    add('LDA absolute,X no crossing',[0xBD,0x1F,0xC0],4,{operation:'lda',data:[[0xC020,3,'R']]});
    add('LDX #$21',[0xA2,0x21],2,{reg:['X',0x21]});
    add('LDA absolute,X page crossing',[0xBD,0xFF,0xBF],5,
        {operation:'lda',data:[[0xBF20,3,'R'],[0xC020,4,'R']]});
    add('LDY #0',[0xA0,0],2,{reg:['Y',0]});
    add('LDA (ZP),Y no crossing',[0xB1,0x42],5,
        {operation:'lda',pointer:0xC020,data:[[0x42,2,'R'],[0x43,3,'R'],[0xC020,4,'R']]});
    add('LDY #$21',[0xA0,0x21],2,{reg:['Y',0x21]});
    for (const pair of [['LDA',0xB1,'lda'],['CMP',0xD1,'cmp'],['EOR',0x51,'eor'],['SBC',0xF1,'sbc']])
        add(pair[0]+' (ZP),Y page crossing',[pair[1],0x42],6,
            {operation:pair[2],pointer:0xBFFF,data:[[0x42,2,'R'],[0x43,3,'R'],[0xBF20,4,'R'],[0xC020,5,'R']]});
    add('LDY #0 for ZP wrap',[0xA0,0],2,{reg:['Y',0]});
    add('LDA ($FF),Y pointer wraps at $00',[0xB1,0xFF],5,
        {operation:'lda',wrapPointer:true,data:[[0xFF,2,'R'],[0,3,'R'],[0xC020,4,'R']]});
    add('LDX #1 for stores/RMW',[0xA2,1],2,{reg:['X',1]});
    add('LDA $FFFF,X wraps to $0000',[0xBD,0xFF,0xFF],5,
        {operation:'lda',data:[[0xFF00,3,'R'],[0,4,'R']]});
    add('STA absolute',[0x8D,0,0x63],4,{store:true,data:[[0x6300,3,'W']]});
    add('STA absolute,X dummy read',[0x9D,0xFF,0x62],5,
        {store:true,data:[[0x6200,3,'R'],[0x6300,4,'W']]});
    add('INC absolute read/write/write',[0xEE,1,0x63],6,
        {rmw:'inc',seed:true,data:[[0x6301,3,'R'],[0x6301,4,'W'],[0x6301,5,'W']]});
    for (const pair of [['ASL',0x1E,'asl'],['ROL',0x3E,'rol'],['LSR',0x5E,'lsr'],
        ['ROR',0x7E,'ror'],['DEC',0xDE,'dec'],['INC',0xFE,'inc']])
        add(pair[0]+' absolute,X dummy read and two writes',[pair[1],0,0x63],7,
            {rmw:pair[2],seed:true,data:[[0x6301,3,'R'],[0x6301,4,'R'],[0x6301,5,'W'],[0x6301,6,'W']]});
    lda('PB0 low / D0-D6 float',0xC061,{button:false,d7:0});
    lda('PB0 high / D0-D6 float',0xC061,{button:true,d7:0x80});
    lda('PB0 mirror at $C069',0xC069,{button:true,d7:0x80});
    lda('Paddle trigger read floats',0xC070,{trigger:true});
    lda('PDL0 charged',0xC064,{paddle:true});
    lda('PDL0 mirror charged',0xC06C,{paddle:true});
    add('BIT between paddle reads',[0x2C,0x20,0xC0],4,{operation:'bit',data:[[0xC020,3,'R']]});
    lda('PDL0 expires at effective CPU cycle',0xC064,{paddle:true});
    add('Paddle trigger write',[0x8D,0x70,0xC0],4,{trigger:true,store:true,data:[[0xC070,3,'W']]});
    lda('PDL0 after write trigger',0xC064,{paddle:true});
    add('NOP paddle delay',[0xEA],2);
    lda('PDL0 mirrored after write trigger',0xC06C,{paddle:true});
    add('NOP expiry delay',[0xEA],2);
    lda('PDL0 expired after write trigger',0xC064,{paddle:true});
    mode('GRAPHICS / old text fetch',0xC050,'gfx',true);
    mode('HIRES / old lores fetch',0xC057,'hires',true);
    lda('HIRES PAGE1 floating read',0xC020);
    mode('PAGE2 / preceding PAGE1 fetch',0xC055,'page2',true);
    lda('HIRES PAGE2 floating read',0xC020);
    mode('MIXED on / preceding full-hires fetch',0xC053,'mix',true);
    lda('HIRES MIXED floating read',0xC020);
    mode('PAGE1 in mixed mode',0xC054,'page2',false);
    mode('TEXT after graphics',0xC051,'gfx',false);
    const jsr = add('JSR delayed high-byte fetch',[0x20,0,0],6,{jsr:true});
    let end = ENTRY;
    cases.forEach(function(c) { c.pc=end; end+=c.bytes.length; });
    const DONE=end, SUB=DONE+3;
    jsr.bytes[1]=SUB & 255; jsr.bytes[2]=SUB >> 8;
    add('RTS returns with original SP',[0x60],6,{pc:SUB,rts:true});
    const program=[];
    cases.slice(0,-1).forEach(function(c) { program.push.apply(program,c.bytes); });
    program.push(0x4C,DONE & 255,DONE >> 8,0x60);
    need(SUB<0x6300,'Program overlaps test data.');

    let active=null, index=0, accesses=[], snapshots=[], savedMode=null, game=null, gameSaved=null;
    let readOriginal=null, writeOriginal=null, readObserver=null, writeObserver=null, deadline=0;
    const session={version:'1.0',entry:ENTRY,done:DONE,subroutine:SUB,condition:CONDITION,status:'READY',
        instructionCount:cases.length,scannerPositions:0,program:program.slice(),
        listing:cases.map(function(c) { return {pc:c.pc,bytes:c.bytes.slice(),name:c.name,ticks:c.ticks}; }),
        results:[],error:null,cleanup:cleanup};
    window.VAPORLOCK_STEPTRACE=session;

    function fixture(address) { return (address ^ (address>>4) ^ (address>>8) ^ 0x5A) & 255; }
    function phase(tick) { return ((Math.floor(tick)%17030)+17030)%17030; }
    // Independent oracle: no runtime scanner/address/floating-bus getter is used.
    // Visible addresses use the Apple II text/hires row permutation; HBL extends
    // its column adder into the blanking interval and repeats the preset state.
    function reference(tick, m) {
        const q=phase(tick), line=Math.floor(q/65), h=q%65;
        const v=line>=256?line-6:line+256;
        let hc=(h+40)%65;
        const hs=(24+hc-(hc>=41?1:0))%64;
        const row=((v>>3)&7)*128;
        const col=(hs%8)+8*((13+Math.floor(hs/8)+5*((v>>6)&3))%16);
        const high=m.gfx && m.hires && !(m.mix && (v & 0xA0)===0xA0);
        return {address:high?(m.page2?0x4000:0x2000)+(v%8)*1024+row+col:
            (m.page2?0x800:0x400)+row+col+(h<25?0x1000:0),
            line:line,hcycle:h,frameCycle:q,hblank:h<25,vblank:line>=192,
            hState:hs,vState:v};
    }
    function save(address,length) { snapshots.push({address:address,bytes:ram.read(address,length)}); }
    function cleanup() {
        if (readObserver && hw.read===readObserver) hw.read=readOriginal;
        if (writeObserver && hw.write===writeObserver) hw.write=writeOriginal;
        readObserver=writeObserver=null;
        if (savedMode) {
            Object.keys(savedMode).forEach(function(k) { hw.setVideoMode(k,savedMode[k]); });
            savedMode=null;
        }
        if (gameSaved) {
            game.state.paddles[0]=gameSaved.paddle;
            game.state.switches[0]=gameSaved.button;
            gameSaved=null;
        }
        const restore=snapshots; snapshots=[];
        restore.forEach(function(s) { ram.write(s.address,s.bytes); });
        if (readOriginal) hw.setBusMonitoring(false);
        if (session.status==='RUNNING') session.status='CANCELLED';
    }
    function check(ok,text) { need(ok,text); }
    function sameTick(actual,expected) {
        // Epoch multiplication and local addition can differ by one floating
        // point ULP after a fractional SYSTEM phase. Raster/address checks stay exact.
        return Math.abs(actual-expected)<=4*Number.EPSILON*Math.max(1,Math.abs(expected));
    }
    function scannerChecks() {
        const origin=hw.getVideoTicks();
        function at(t) { return t-origin; } // fixed IPS mode must be 1:1
        const m={gfx:false,mix:false,page2:false,hires:false};
        Object.keys(m).forEach(function(k) { hw.setVideoMode(k,m[k]); });
        const literals=[[0,0x1468],[1,0x1468],[24,0x147F],[25,0x400],[64,0x427],
            [191*65+64,0x7F7],[192*65+25,0x478],[256*65+25,0x7F8],
            [261*65+64,0x79F],[17030,0x1468],[-1,0x79F]];
        literals.forEach(function(p) {
            check(reference(p[0],m).address===p[1],'Reference literal at tick '+p[0]);
            check(hw.getScannerAddress(at(p[0]))===p[1],'Scanner literal at tick '+p[0]);
        });
        const modes=[m,{gfx:false,mix:false,page2:true,hires:false},
            {gfx:true,mix:false,page2:false,hires:true},
            {gfx:true,mix:false,page2:true,hires:true},
            {gfx:true,mix:true,page2:false,hires:true},
            {gfx:true,mix:true,page2:true,hires:true}];
        modes.forEach(function(mode,n) {
            Object.keys(mode).forEach(function(k) { hw.setVideoMode(k,mode[k]); });
            for (let t=0;t<17030;t++) {
                const expected=reference(t,mode), position=hw.getScannerState(at(t));
                check(hw.getScannerAddress(at(t))===expected.address,'Scanner mode '+n+' tick '+t+' address');
                ['line','hcycle','frameCycle','hblank','vblank','hState','vState'].forEach(function(k) {
                    check(position[k]===expected[k],'Scanner mode '+n+' tick '+t+' '+k);
                });
            }
        });
        Object.keys(savedMode).forEach(function(k) { hw.setVideoMode(k,savedMode[k]); });
        session.scannerPositions=102180;
        print('PASS scanner: literal boundaries plus 102180 frame/mode positions');
    }
    function start() {
        need(!hw.nmi_signal,'Pending NMI: use a machine without active interrupt sources.');
        need(!hw.irq_signal || (cpu.state().p & 4),'Pending IRQ before SEI.');
        const games=Object.keys(hw.io.attachments).map(function(k) { return hw.io.attachments[k].device; })
            .filter(function(d) { return d && d.id && d.id.DCODE==='A2GAM' && d.id.hostPCODE==='A2BO'; });
        need(games.length===1 && games[0].state,'Mount exactly one standard Apple II game-port device.');
        game=games[0];
        savedMode=hw.getVideoMode();
        scannerChecks();
        // Save and restore only declared scratch/fixture ranges. Program stays
        // resident so the final stopped PC still points at meaningful code.
        save(0x400,0x5C00); save(0x42,2); save(0xFF,1); save(0,1);
        save(0x6300,2); save(0xBF20,1); save(0x100,0x100);
        const fill=new Uint8Array(0x5C00);
        for (let i=0;i<fill.length;i++) fill[i]=fixture(0x400+i);
        ram.write(0x400,fill); ram.write(0xBF20,0x3D); ram.write(0x6300,[0x37,0x12]);
        gameSaved={paddle:game.state.paddles[0],button:game.state.switches[0]};
        game.state.paddles[0]=1;
        readOriginal=hw.read; writeOriginal=hw.write;
        hw.setBusMonitoring(true);
        readObserver=function(address,offset) {
            const observing=!hw.bRO;
            const value=readOriginal.call(this,address,offset);
            if (observing) accesses.push(hw.getLastBusAccess());
            return value;
        };
        writeObserver=function(address,value,offset) {
            const observing=!hw.bRO;
            const result=writeOriginal.call(this,address,value,offset);
            if (observing) accesses.push(hw.getLastBusAccess());
            return result;
        };
        hw.read=readObserver; hw.write=writeObserver;
        session.status='RUNNING';
    }
    function expectedAccess(address,offset,rw,value,mask,m,tick) {
        const scan=reference(tick+offset,m);
        return {address:address,cycleOffset:offset,rw:rw,result:value,mask:mask,
            scannerAddress:scan.address,floatingValue:fixture(scan.address),
            line:scan.line,hcycle:scan.hcycle,frameCycle:scan.frameCycle,hState:scan.hState,vState:scan.vState};
    }
    function prepare(c,bp) {
        accesses=[];
        if (c.pointer!==undefined) ram.write16(0x42,c.pointer);
        if (c.wrapPointer) { ram.write(0xFF,0x20); ram.write(0,0xC0); }
        if (c.seed) ram.write(0x6301,0x12);
        if (c.trigger) game.state.paddles[0]=1;
        if (c.button!==undefined) game.state.switches[0]=c.button;
        const m=hw.getVideoMode(), tick=hw.getVideoTicks(), cpuTick=hw.getCpuTicks(), expected=[];
        const registers={A:bp.A,X:bp.X,Y:bp.Y,SP:bp.SP};
        let flagMask=0, flags=0, sample=0, output=0;
        function read(a,o,v,mask) { expected.push(expectedAccess(a,o,'R',v,mask===undefined?255:mask,m,tick)); }
        function write(a,o,v) { expected.push(expectedAccess(a,o,'W',v,255,m,tick)); }
        read(c.pc,0,c.bytes[0]);
        if (c.jsr) {
            read(c.pc+1,1,c.bytes[1]); read(0x100+bp.SP,2,ram.read(0x100+bp.SP));
            write(0x100+bp.SP,3,(c.pc+2)>>8); write(0x100+((bp.SP-1)&255),4,(c.pc+2)&255);
            read(c.pc+2,5,c.bytes[2]); registers.SP=(bp.SP-2)&255;
        } else if (c.rts) {
            read(0x100+((bp.SP+1)&255),3,ram.read(0x100+((bp.SP+1)&255)));
            read(0x100+((bp.SP+2)&255),4,ram.read(0x100+((bp.SP+2)&255)));
            registers.SP=(bp.SP+2)&255;
        } else {
            for (let i=1;i<c.bytes.length;i++) read(c.pc+i,i,c.bytes[i]);
            if (c.rmw) {
                const carry=bp.P & 1;
                output={inc:0x13,dec:0x11,asl:0x24,rol:0x24+carry,lsr:9,ror:9+128*carry}[c.rmw];
            }
            (c.data || []).forEach(function(d,j) {
                const a=d[0],o=d[1],rw=d[2];
                let value,mask=255;
                if (rw==='W') value=c.rmw?(j===c.data.length-1?output:0x12):bp.A;
                else if (a>=0xC000 && a<0xC100) {
                    mask=c.d7!==undefined || c.paddle?128:0;
                    value=fixture(reference(tick+o,m).address);
                    if (mask===128) {
                        const bit=c.paddle?(cpuTick+o<deadline?128:0):c.d7;
                        value=(value & 127)|bit;
                    }
                } else value=ram.read(a);
                expected.push(expectedAccess(a,o,rw,value,mask,m,tick));
                if (rw==='R') sample=value;
            });
        }
        function nz(v) { flagMask|=0x82; flags|=(v & 128)|(v===0?2:0); }
        if (c.reg) { registers[c.reg[0]]=c.reg[1]; nz(c.reg[1]); }
        if (c.operation==='lda') { registers.A=sample; nz(sample); }
        if (c.operation==='eor') { registers.A=bp.A ^ sample; nz(registers.A); }
        if (c.operation==='cmp') { const d=(bp.A-sample)&255; nz(d); flagMask|=1; flags|=bp.A>=sample?1:0; }
        if (c.operation==='sbc') {
            const d=bp.A-sample-(bp.P & 1?0:1);
            registers.A=d & 255; nz(registers.A); flagMask|=0x41;
            flags|=(d>=0?1:0)|(((bp.A ^ sample) & (bp.A ^ registers.A) & 128)?64:0);
        }
        if (c.operation==='bit') { flagMask=0xC2; flags=(sample & 0xC0)|((bp.A & sample)===0?2:0); }
        if (c.rmw) {
            nz(output);
            if (['asl','rol','lsr','ror'].indexOf(c.rmw)>=0) { flagMask|=1; flags|=0; } // $12 has neither bit 7 nor bit 0
        }
        if (c.trigger) deadline=cpuTick+3+11;
        const after=Object.assign({},m);
        if (c.change) after[c.change[0]]=c.change[1];
        return {c:c,expected:expected,registers:registers,flagMask:flagMask,flags:flags,
            tick:tick,cpuTick:cpuTick,ins:bp.INS,mode:after};
    }
    function verify(a,bp) {
        const c=a.c;
        check(bp.INS===a.ins+1,c.name+': one completed instruction');
        check(hw.getCpuTicks()===a.cpuTick+c.ticks,c.name+': CPU ticks');
        check(sameTick(hw.getVideoTicks(),a.tick+c.ticks),c.name+': video ticks (use fixed IPS)');
        check(accesses.length===a.expected.length,c.name+': bus access count '+accesses.length+' != '+a.expected.length);
        accesses.forEach(function(actual,i) {
            need(actual,c.name+': missing diagnostic record');
            Object.keys(a.expected[i]).forEach(function(k) {
                check(actual[k]===a.expected[i][k],c.name+': access '+i+' '+k+' '+actual[k]+' != '+a.expected[i][k]);
            });
            check(actual.cpuTick===a.cpuTick,c.name+': access base CPU tick');
            check(actual.effectiveCpuTick===a.cpuTick+actual.cycleOffset,c.name+': effective CPU tick');
            check(sameTick(actual.effectiveTick,a.tick+actual.cycleOffset),c.name+': effective video tick');
        });
        Object.keys(a.registers).forEach(function(k) { check(bp[k]===a.registers[k],c.name+': register '+k); });
        check((bp.P & a.flagMask)===a.flags,c.name+': result flags');
        const m=hw.getVideoMode();
        Object.keys(a.mode).forEach(function(k) { check(m[k]===a.mode[k],c.name+': video latch '+k); });
        const last=hw.getLastBusAccess();
        hw.safe_read(0xC055); hw.peekFloatingBus(); hw.getVideoPosition();
        check(JSON.stringify(hw.getLastBusAccess())===JSON.stringify(last),c.name+': observer changed diagnostics');
        check(JSON.stringify(hw.getVideoMode())===JSON.stringify(m),c.name+': safe read changed PAGE2');
        check(hw.getCpuTicks()===a.cpuTick+c.ticks && sameTick(hw.getVideoTicks(),a.tick+c.ticks),c.name+': observer advanced time');
        session.results.push({name:c.name,pc:c.pc,pass:true,ticks:c.ticks,startCpuTick:a.cpuTick,
            startVideoTick:a.tick,startINS:a.ins,accesses:accesses.slice()});
        print('PASS '+c.name+' / '+c.ticks+' cycles');
    }

    // Arming injects bytes once. CPU control stays with the monitor/debugger.
    ram.write(ENTRY,program);
    print('Vaporlock NTSC II/II+ scenario ready; '+cases.length+' instructions');
    print('BREAK IF: '+CONDITION+' / entry '+STB.hex(ENTRY,4)+' / done '+STB.hex(DONE,4));
    onBreakpoint(function(bp) {
        try {
            if (!active && index===0) { check(bp.PC===ENTRY,'Start at '+STB.hex(ENTRY,4)); start(); }
            if (active) verify(active,bp);
            if (index===cases.length) {
                check(bp.PC===DONE,'Final PC is the terminal JMP');
                session.status='PASS'; cleanup();
                print('PASS COMPLETE: '+session.results.length+'/'+cases.length+' instructions; fixtures restored');
                haltAtBreakpoint(); return;
            }
            const c=cases[index++];
            check(bp.PC===c.pc,c.name+': PC '+STB.hex(bp.PC,4)+' != '+STB.hex(c.pc,4));
            active=prepare(c,bp);
        } catch (error) {
            session.status='FAIL'; session.error=error.message;
            session.results.push({name:active?active.c.name:'setup',pass:false,error:error.message,
                actualBoundary:{PC:bp.PC,A:bp.A,X:bp.X,Y:bp.Y,SP:bp.SP,P:bp.P,INS:bp.INS},
                expectedRegisters:active?active.registers:null,expectedAccesses:active?active.expected:[],
                accesses:accesses.slice()});
            assert(false,error.message);
            cleanup(); haltAtBreakpoint();
        }
    });
})();
