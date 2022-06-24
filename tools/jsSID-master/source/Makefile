all:
	./remccoms3.sed jsSID.js > jsSID-nocomment.js
	sed -e "s/C64_PAL_CPUCLK/CLK/g; s/PAL_FRAMERATE/FR/g; s/SID_CHANNEL_AMOUNT/CHA/g; s/OUTPUT_SCALEDOWN/SCALE/g; \
     s/frame_sampleperiod/fspd/g; s/GATE_BITMASK/GAT/g; s/SYNC_BITMASK/SYN/g; s/RING_BITMASK/RNG/g; s/TEST_BITMASK/TST/g;  \
     s/TRI_BITMASK/TRI/g; s/SAW_BITMASK/SAW/g; s/PULSE_BITMASK/PUL/g; s/NOISE_BITMASK/NOI/g; s/HOLDZERO_BITMASK/HZ/g; \
     s/DECAYSUSTAIN_BITMASK/DECSUS/g; s/ATTACK_BITMASK/ATK/g; s/FILTSW/FSW/g; s/LOWPASS_BITMASK/LP/g; s/BANDPASS_BITMASK/BP/g;  \
     s/HIGHPASS_BITMASK/HP/g; s/OFF3_BITMASK/OFF3/g; s/SIDreg/reg/g; s/clk_ratio/ckr/g; s/phaseaccu/pacc/g; s/noise_LFSR/nLFSR/g;  \
     s/prevlowpass/plp/g; s/prevbandpass/pbp/g; s/cutoff_ratio_8580/ctfr/g; s/samplerate/smpr/g; s/prevgate/pgt/g; s/prevaccu/pracc/g; \
     s/cutoff/ctf/g; s/resonance/reso/g; s/filtin/flin/g; s/channel/chn/g; s/framespeed/fsp/g; s/sourceMSB/sMSB/g; \
     s/SID_model/SIDm/g; s/background_noise/bgnoi/g; s/combinedWF/cmbWF/g; s/createCombinedWF/cCmbWF/g; s/bufferlen/bufln/g; \
     s/TriSaw_8580/trsaw/g; s/PulseSaw_8580/pusaw/g; s/bitstrength/bstr/g; s/prevwavdata/pwv/g; s/ADSRperiods/Aprd/g; s/ratecnt/rcnt/g;  \
     s/ADSRstep/Astp/g; s/ADSR_exptable/Aexp/g; s/treshold/trh/g; s/period/prd/g; s/accuadd/aAdd/g; s/ADSRstate/Ast/g; s/prevSR/pSR/g; \
     s/bitlevel/blvl/g; s/wfarray/wfa/g; s/jsSID_audioCtx/aCtx/g; s/jsSID_scriptNode/scrNod/g; s/request/req/g;  \
     s/outBuffer/oBuf/g; s/outData/oDat/g; s/filedata/fdat/g; s/tunedata/tdat/g; s/framecnt/fcnt/g; s/tunepos/tpos/g;  \
     s/memory/M/g; s/SIDtitle/tit/g; s/SIDauthor/auth/g; s/SIDinfo/inf/g; s/preferred_SIDm/prSIDm/g; s/loaded/ldd/g; s/initialized/ind/g;  \
     s/playaddr/pla/g; s/playaddf/plf/g; s/initaddr/ina/g; s/loadaddr/ldad/g;  s/timermode/tmod/g; s/timeout/tout/g;  \
     s/finished/fin/g; s/branchflag/brf/g; s/cycles/cyc/g; s/storadd/sta/g;  /^ *$$/d "  \
     jsSID-nocomment.js > jsSID-shortvars.js
	#sed -e "s/[[:space:]]//g" jsSID-shortvars.js > jsSID-nospace.js #this only deletes whitespace, newlines stay intact
	cat jsSID-shortvars.js | tr -d "[:space:]" > jsSID-nospace.js  #this deletes whitespace AND newlines (stripping 100..200 bytes more)
	sed -i -e "s/function/function /g; s/function '/function'/g; s/var/var /g; ;s/}var/};var/g; s/new/new /g; s/typeof/typeof /g; s/else/else /g;  \
	    s/return/return /g; s/}this./};this./g; s/case/case /g; " jsSID-nospace.js
	chmod 755 *
	cp jsSID-nospace.js ../jsSID.js
	chmod 755 ../jsSID.js

clean:
	rm jsSID-nocomment.js jsSID-shortvars.js jsSID-nospace.js sidrip ../jsSID.js
