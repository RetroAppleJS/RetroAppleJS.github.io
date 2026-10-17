// Offline PSID activity analysis UI for tools/SIDchipJS.html.
(function () {
    'use strict';
    var currentJob = 0, pendingTimer = null;
    var FEATURES = [
        ['Oscillators', [
            ['triangle','Triangle waveform'],['sawtooth','Sawtooth waveform'],
            ['pulse','Pulse / square waveform'],['noise','Noise waveform'],
            ['combinedWaveforms','Combined waveforms'],['frequencyWrites','Frequency-register writes'],
            ['pulseWidthWrites','Pulse-width-register writes']]],
        ['Modulation and gates',[
            ['hardSync','Oscillator hard sync'],['ringModulation','Ring modulation'],
            ['oscillatorTest','Oscillator TEST'],['gateOn','Gate on / attack triggered'],
            ['gateOff','Gate off / release triggered']]],
        ['ADSR',[
            ['attackDecayWrites','Attack/decay configuration writes'],
            ['sustainReleaseWrites','Sustain/release configuration writes']]],
        ['Filter',[
            ['cutoffWrites','Filter cutoff writes'],['resonanceWrites','Resonance changes'],
            ['filterRouting','Newly enabled filtered inputs'],['lowPass','Low-pass enabled'],
            ['bandPass','Band-pass enabled'],['highPass','High-pass enabled']]],
        ['Output and SID reads',[
            ['voice3Mute','Voice 3 output muted'],['masterVolumeWrites','Master-volume register writes'],
            ['volumeChanges','Volume changes'],['possibleDigiWrites','Potential digital sample writes'],
            ['potXReads','POTX reads'],['potYReads','POTY reads'],
            ['osc3Reads','OSC3 reads'],['env3Reads','ENV3 reads']]]
    ];
    var REGISTER_NAMES = [
        'Voice 1 frequency low','Voice 1 frequency high',
        'Voice 1 pulse width low','Voice 1 pulse width high','Voice 1 control',
        'Voice 1 attack/decay','Voice 1 sustain/release',
        'Voice 2 frequency low','Voice 2 frequency high',
        'Voice 2 pulse width low','Voice 2 pulse width high','Voice 2 control',
        'Voice 2 attack/decay','Voice 2 sustain/release',
        'Voice 3 frequency low','Voice 3 frequency high',
        'Voice 3 pulse width low','Voice 3 pulse width high','Voice 3 control',
        'Voice 3 attack/decay','Voice 3 sustain/release',
        'Filter cutoff low','Filter cutoff high','Resonance / filter routing',
        'Filter mode / master volume','POTX (readable)','POTY (readable)',
        'OSC3 (readable)','ENV3 (readable)',
        'Unused / open bus','Unused / open bus','Unused / open bus'
    ];
    function $(id) { return document.getElementById(id); }
    function element(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function parsePSID() {
        var source = $('b64').value.trim();
        if (source.indexOf('PASTE HERE YOUR INPUT SID FILE') >= 0 &&
            typeof b64 === 'string') source = b64;
        source = source.replace(/\s+/g,'');
        if (!/^[a-z0-9+/]+={0,2}$/i.test(source))
            throw new Error('Load a valid Base64-encoded PSID first.');
        var binary = atob(source), data = new Uint8Array(binary.length);
        for (var i=0; i<binary.length; i++) data[i] = binary.charCodeAt(i);
        if (data.length < 0x7C ||
            String.fromCharCode.apply(null,data.subarray(0,4)) !== 'PSID')
            throw new Error('Analysis supports PSID files; RSID requires C64 hardware emulation.');
        var songs = (data[14]<<8)|data[15];
        if (!songs || songs > 256) throw new Error('Invalid PSID subtune count.');
        function headerText(offset) {
            var title='';
            for(var i=offset; i<offset+32 && data[i]; i++)title+=String.fromCharCode(data[i]);
            return title;
        }
        return {source:source, songs:songs, title:headerText(0x16),
                author:headerText(0x36), start:((data[0x10]<<8)|data[0x11])||1};
    }
    function addCell(row,value,head) {
        var cell = element(head?'th':'td',null,String(value));
        row.appendChild(cell);
        return cell;
    }
    function makeTable(titles,rows) {
        var table=element('table','sid-analysis-table');
        var thead=element('thead'),header=element('tr');
        for (var i=0;i<titles.length;i++) addCell(header,titles[i],true);
        thead.appendChild(header);table.appendChild(thead);
        var body=element('tbody');
        for(var j=0;j<rows.length;j++){
            var row=element('tr');
            for(var k=0;k<rows[j].length;k++)addCell(row,rows[j][k],false);
            body.appendChild(row);
        }
        table.appendChild(body);
        return table;
    }
    function hex(v) { return '$'+v.toString(16).toUpperCase().padStart(4,'0'); }
    function featuresTable(chip) {
        var rows=[];
        FEATURES.forEach(function(group) {
            rows.push([group[0],'']);
            group[1].forEach(function(pair){
                rows.push([pair[1],chip.features[pair[0]]||0]);
            });
        });
        return makeTable(['6581 / 8580 feature', 'Events / writes'],rows);
    }
    function registerTable(chip) {
        var rows=[];
        for(var i=0;i<32;i++){
            rows.push([hex(chip.base+i),REGISTER_NAMES[i],chip.reads[i],chip.writes[i]]);
        }
        return makeTable(['Address','Register','CPU reads','CPU writes'],rows);
    }
    function showTune(report, index) {
        var parent=$('sidAnalysisResults');
        var details=element('details','sid-analysis-tune');
        if(index===0)details.open=true;
        var totalReads=0,totalWrites=0;
        report.chips.forEach(function(chip){
            chip.reads.forEach(function(n){totalReads+=n});
            chip.writes.forEach(function(n){totalWrites+=n});
        });
        var status=report.complete ?
           ('loop begins at tick '+report.loopStartFrame+
            ', repeats after '+report.loopLengthFrames+' ticks') :
           ('partial: '+report.reason);
        var summary=element('summary',null,'Subtune '+report.subtune+
            ' — '+report.seconds.toFixed(2)+' s — R '+totalReads+
            ' / W '+totalWrites+' — '+status);
        details.appendChild(summary);
        report.chips.forEach(function(chip,num){
            var section=element('section','sid-analysis-chip');
            section.appendChild(element('h4',null,'SID '+(num+1)+' ('+hex(chip.base)+
                '–'+hex(chip.base+31)+') — PSID preferred '+chip.preferredModel));
            section.appendChild(element('h5',null,'6581 / 8580 features'));
            section.appendChild(featuresTable(chip));
            section.appendChild(element('h5',null,'All 32 register addresses — actual CPU instructions'));
            section.appendChild(registerTable(chip));
            details.appendChild(section);
        });
        report.warnings.forEach(function(w){
            details.appendChild(element('p','sid-analysis-warning',w));
        });
        parent.appendChild(details);
    }
    function status(text) { $('sidAnalysisStatus').textContent=text; }
    function cancel() {
        currentJob++;
        if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
        status('Analysis cancelled.');
    }
    function analyze() {
        cancel();
        var job=++currentJob, meta, maxSeconds;
        var result=$('sidAnalysisResults');
        result.textContent='';
        try {
            meta=parsePSID();
            maxSeconds=Number($('sidAnalysisSeconds').value);
            if (!Number.isInteger(maxSeconds) || maxSeconds<1 || maxSeconds>600)
                throw new Error('Maximum analysis duration must be 1–600 seconds.');
            if (typeof jsSID!=='function')
                throw new Error('jsSID is not loaded.');
        }catch(e){status('Error: '+e.message);return;}
        status('Analyzing '+(meta.title||'PSID')+' ('+meta.songs+' subtunes)...');
        var tune=0, loops=0, incomplete=0;
        function next() {
            if(job!==currentJob)return;
            if(tune>=meta.songs){
                status('Analyzed '+meta.songs+' subtunes. Loops detected: '+loops+
                    '; not proven to loop before cutoff: '+incomplete+'.');
                return;
            }
            status('Analyzing '+(meta.title||'PSID')+
                ' — subtune '+(tune+1)+' / '+meta.songs+'...');
            try {
                // One isolated headless player for each subtune, for clean RAM
                // initialization and no interference with normal WebAudio.
                var engine=new jsSID(4096,0,{headless:true});
                engine.loadinit_b64(meta.source,tune);
                var report=engine.analyzeSIDSubtune(tune,maxSeconds);
                showTune(report,tune);
                if(report.complete)loops++;else incomplete++;
            }catch(e) {
                incomplete++;
                result.appendChild(element('p','sid-analysis-warning',
                    'Subtune '+(tune+1)+': '+e.message));
            }
            tune++;
            pendingTimer=setTimeout(next,0);
        }
        pendingTimer=setTimeout(next,0);
    }
    function schedule() {
        if ($('sidAnalysisAuto') && $('sidAnalysisAuto').checked) {
            if(pendingTimer!==null)clearTimeout(pendingTimer);
            pendingTimer=setTimeout(analyze,0);
        }
    }
    window.sidAnalysisRun=analyze;
    window.sidAnalysisCancel=cancel;
    window.sidAnalysisSchedule=schedule;
})();
