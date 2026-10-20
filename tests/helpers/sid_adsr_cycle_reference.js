'use strict';
/*
 * Phase 4C.0 independent SID ADSR behavioral *test oracle*.
 *
 * A deliberately slow one-SID-clock-at-a-time reference. It implements
 * documented register-level ADSR timing rules, not transistor circuitry
 * and not a copy of reSID code.  It does not run in production.
 *
 * Useful background: Commodore 64 Programmer's Reference Guide ADSR table;
 * libsidplayfp SID internals envelope overview and reSID ADSR delay notes.
 * Due to gate-write pipelining and hardware-revision subtleties, comparisons
 * with the production device are diagnostic until Phase 4C.1 resolves them.
 */
const PERIODS=Object.freeze([
  9,32,63,95,149,220,267,313,392,977,1954,3126,3907,11720,19532,31251
]);
function dividerAt(level,current){
  // Divider reload occurs at exact ENV count transitions only.
  if(level===255)return 1;
  if(level===93)return 2;
  if(level===54)return 4;
  if(level===26)return 8;
  if(level===14)return 16;
  if(level===6)return 30;
  if(level===0)return 1;
  return current;
}
class Envelope {
  constructor(){
    this.level=0;
    this.stage='release';
    this.rateCounter=0;
    this.expCounter=0;
    this.expPeriod=1;
    this.holdZero=true;
    this.ad=0;
    this.sr=0;
    this.gate=false;
    this.cycles=0;
  }
  write(reg,value){
    value&=0xff;
    if(reg===5){this.ad=value;return;}
    if(reg===6){this.sr=value;return;}
    if(reg!==4)throw new RangeError('Expected voice register offset 4–6');
    const gate=!!(value&1);
    if(gate!==this.gate){
      this.stage=gate?'attack':'release';
      if(gate)this.holdZero=false;
      this.gate=gate;
      // Do NOT reset rateCounter or expCounter on a gate edge.
    }
  }
  period(){
    if(this.stage==='attack')return PERIODS[this.ad>>>4];
    if(this.stage==='decay')return PERIODS[this.ad&15];
    return PERIODS[this.sr&15];
  }
  step(){
    this.cycles++;
    // Idealized 15-bit SID divider: omit the 0x8000 state at wrap.
    let next=this.rateCounter+1;
    if(next===0x8000)next=1;
    this.rateCounter=next;
    if(next!==this.period())return;
    this.rateCounter=0;
    if(this.stage!=='attack'){
      this.expCounter++;
      if(this.expCounter!==this.expPeriod)return;
    }
    this.expCounter=0;
    if(this.holdZero)return;
    if(this.stage==='attack'){
      this.level=(this.level+1)&255;
      if(this.level===255)this.stage='decay';
    }else if(this.stage==='release'||this.level!==((this.sr>>>4)*17)){
      this.level=(this.level-1)&255;
      if(this.level===0)this.holdZero=true;
    }
    this.expPeriod=dividerAt(this.level,this.expPeriod);
  }
  advance(cycles){
    if(!Number.isInteger(cycles)||cycles<0||cycles>1000000)
      throw new RangeError('Oracle step range is 0–1,000,000 SID cycles');
    while(cycles-->0)this.step();
    return this.level;
  }
  snapshot(){
    return {cycles:this.cycles,level:this.level,stage:this.stage,
      rateCounter:this.rateCounter,expCounter:this.expCounter,
      expPeriod:this.expPeriod,holdZero:this.holdZero};
  }
}
// Compare a sampled production trace to the independent cycle model.
// Gate/register writes are interpreted at their recorded PCM boundary.
// Phase 4C.0 produces discrepancy statistics, NOT a pass/fail hardware verdict.
function compareTrace(trace){
  const voices=[new Envelope(),new Envelope(),new Envelope()];
  const stats=voices.map(()=>({observations:0,mismatches:0,
    absoluteErrorSum:0,maxAbsoluteError:0,firstMismatch:null}));
  let previousTick=0,index=0;
  for(const point of trace.points){
    const elapsed=point.cpuTick-previousTick;
    if(elapsed<0)throw new Error('Nonmonotonic envelope trace');
    for(const v of voices)v.advance(elapsed);
    previousTick=point.cpuTick;
    while(index<trace.events.length && trace.events[index].sample<=point.sample){
      const ev=trace.events[index++];
      if(ev.reg<21){
        const voice=(ev.reg/7)|0,offset=ev.reg%7;
        if(offset>=4&&offset<=6)voices[voice].write(offset,ev.value);
      }
    }
    for(let i=0;i<3;i++){
      const expected=voices[i].level,observed=point['v'+(i+1)];
      const error=Math.abs(expected-observed),stat=stats[i];
      stat.observations++;
      stat.absoluteErrorSum+=error;
      if(error>stat.maxAbsoluteError)stat.maxAbsoluteError=error;
      if(error){
        stat.mismatches++;
        if(!stat.firstMismatch)stat.firstMismatch={
          sample:point.sample,cpuTick:point.cpuTick,
          expected:expected,observed:observed
        };
      }
    }
  }
  return {fixture:trace.fixture,model:trace.model,clock:trace.clock,
    sampleRate:trace.sampleRate,reference:'independent idealized per-cycle ADSR',
    clockQuantization:'sample boundary / rounded SID cycle',
    voices:stats.map(s=>({
      observations:s.observations,mismatches:s.mismatches,
      meanAbsoluteError:s.observations?+(s.absoluteErrorSum/s.observations).toFixed(5):0,
      maxAbsoluteError:s.maxAbsoluteError,firstMismatch:s.firstMismatch
    }))};
}
module.exports={Envelope,PERIODS,dividerAt,compareTrace};
