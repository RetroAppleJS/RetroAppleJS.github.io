// SID-to-Mockingboard extraction for tools/SIDchipJS.html.
// Produces SREG v1 delta-encoded 50 Hz SID register frames for the
// Apple II SID2MB resident player ($6000 stream address).
(function () {
    'use strict';

    var output = null;
    var outputName = 'SONG.SREG';
    var RATE = 50;
    var DEFAULT_LOAD_ADDRESS = 0x6000;
    var RAM_END = 0xC000; // Exclusive: Apple II I/O starts at $C000.

    function getLoadAddress() {
        var field = get('hexadr');
        var value = field ? field.value.trim().replace(/^(?:\$|0x)/i, '') : '6000';
        if (!/^[0-9a-f]{1,4}$/i.test(value))
            throw new Error('Start address must be one to four hexadecimal digits.');
        var address = parseInt(value, 16);
        if (address < DEFAULT_LOAD_ADDRESS || address >= RAM_END)
            throw new Error('Address must be $6000-$BFFF, outside the resident player and I/O space.');
        return address;
    }

    function get(id) { return document.getElementById(id); }
    function hex(value, width) { return value.toString(16).toUpperCase().padStart(width, '0'); }

    function readSIDBase64() {
        // The same Base64 field is used by Load from Base64, Load from File,
        // and the original built-in SID examples (and the ?sid= URI option).
        var raw = get('b64').value;
        // On first open, the textarea still contains its instructional prompt,
        // while SIDchipJS already has a built-in SID in its global b64 variable.
        if (raw.indexOf('PASTE HERE YOUR INPUT SID FILE') !== -1 &&
            typeof b64 === 'string') raw = b64;
        var value = raw.replace(/\s+/g, '');
        if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4)
            throw new Error('Load or paste a valid Base64 PSID file first.');
        var binary;
        try { binary = atob(value); }
        catch (err) { throw new Error('Invalid Base64 SID data.'); }
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i);
        return { bytes: bytes, base64: value };
    }

    function readPSIDHeader(bytes) {
        if (bytes.length < 0x76 || bytes[0] !== 0x50 || bytes[1] !== 0x53 ||
            bytes[2] !== 0x49 || bytes[3] !== 0x44)
            throw new Error('The source must be a PSID file (RSID is not supported).');
        var offset = bytes[6] * 256 + bytes[7];
        if (offset < 0x76 || offset >= bytes.length)
            throw new Error('Invalid PSID data offset.');
        var songs = bytes[0x0e] * 256 + bytes[0x0f];
        if (!songs) throw new Error('The PSID header declares no subtunes.');
        var title = '';
        for (var i = 0x16; i < Math.min(bytes.length, 0x36) && bytes[i]; ++i)
            title += String.fromCharCode(bytes[i]);
        var name = title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
        return { songs: songs, name: (name || 'SONG').slice(0, 32) + '.SREG' };
    }

    function encodeFrames(frames, loop, maxBytes) {
        var data = [0x53, 0x52, 0x45, 0x47, 1, RATE]; // SREG v1 header
        var previous = new Uint8Array(25);
        var count = 0;
        for (var i = 0; i < frames.length; ++i) {
            var frame = frames[i];
            if (!(frame instanceof Uint8Array) || frame.length !== 25)
                throw new Error('Invalid SID register frame at index ' + i);
            var changed = [];
            for (var reg = 0; reg < 25; ++reg)
                if (frame[reg] !== previous[reg]) changed.push(reg, frame[reg]);
            // Leave room for the frame terminator and final loop/end marker.
            if (data.length + changed.length + 2 > maxBytes) break;
            for (var j = 0; j < changed.length; ++j) data.push(changed[j]);
            data.push(0xFF);
            previous.set(frame);
            count++;
        }
        if (count === 0) throw new Error('No register frames fit into the stream.');
        data.push(loop ? 0xFE : 0xFD);
        return { bytes: new Uint8Array(data), count: count };
    }

    function asMonitorText(data, address) {
        var lines = ['CALL-151'];
        for (var i = 0; i < data.length; i += 16) {
            var chunk = data.subarray(i, i + 16);
            var line = hex(address + i, 4) + ': ';
            for (var j = 0; j < chunk.length; ++j)
                line += (j ? ' ' : '') + hex(chunk[j], 2);
            lines.push(line);
        }
        lines.push('BSAVE SONG.SREG,A$' + hex(address, 4) + ',L$' + hex(data.length, 4));
        return lines.join('\n');
    }

    function showStatus(message) { get('sid2mbStatus').textContent = message; }

    function capture() {
        var download = get('sid2mbDownload');
        var monitor = get('hexcode');
        output = null;
        download.disabled = true;
        monitor.value = '';
        showStatus('Extracting SID register frames...');

        // Yield once to let the UI show the status before a CPU-bound capture.
        setTimeout(function () {
            try {
                var address = getLoadAddress();
                var source = readSIDBase64();
                var meta = readPSIDHeader(source.bytes);
                var subtune = Number(get('sid2mbSubtune').value);
                if (!Number.isInteger(subtune) || subtune < 1 || subtune > meta.songs)
                    throw new Error('Subtune must be between 1 and ' + meta.songs + '.');
                var seconds = Number(get('sid2mbSeconds').value);
                if (!Number.isFinite(seconds) || seconds < 1 || seconds > 240)
                    throw new Error('Duration must be between 1 and 240 seconds.');
                if (typeof jsSID !== 'function') throw new Error('The jsSID player is not available.');

                // Use a separate, silent jsSID instance. Do not disturb the
                // currently playing song or its selected subtune.
                var player = new jsSID(4096, 0);
                if (typeof player.captureSIDFrames !== 'function')
                    throw new Error('Missing captureSIDFrames support in res/jsSID.js.');
                player.loadinit_b64(source.base64, subtune - 1);
                var frameCount = Math.round(seconds * RATE);
                var frames = player.captureSIDFrames(frameCount, subtune - 1, RATE);
                var stream = encodeFrames(frames, get('sid2mbLoop').checked, RAM_END - address);
                output = stream.bytes;
                outputName = meta.name;
                monitor.value = asMonitorText(output, address);
                download.disabled = false;
                var actualSeconds = (stream.count / RATE).toFixed(2);
                var truncated = stream.count !== frameCount;
                showStatus('Captured ' + stream.count + ' frames (' + actualSeconds + ' s), ' +
                    output.length + ' bytes at $' + hex(address, 4) + '.' +
                    (truncated ? ' TRUNCATED to fit $' + hex(address, 4) + '-$BFFF.' : '') +
                    (address !== DEFAULT_LOAD_ADDRESS ?
                    ' Note: the current SID2MB resident player expects its stream at $6000.' : ''));
            } catch (err) {
                showStatus('Error: ' + (err && err.message ? err.message : String(err)));
            }
        }, 0);
    }

    function download() {
        if (!output) return;
        var url = URL.createObjectURL(new Blob([output], { type: 'application/octet-stream' }));
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = outputName;
        anchor.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    }

    window.sid2mbCapture = capture;
    window.sid2mbDownload = download;
})();
