//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY AUTHOR AND CONTRIBUTORS ``AS IS'' AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL AUTHOR OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.
//

// apple2main.js

var vidContext = document.getElementById('applescreen').getContext("2d");
var apple2plus = new Apple2Plus(vidContext);
var appleIntervalTime = 50;

window.onkeypress = apple2OnKeyPress;

function appleIntervalFunc() {
    apple2plus.cycle(1000 * appleIntervalTime);
}

var appleIntervalHandle = window.setInterval("appleIntervalFunc()",
                                           appleIntervalTime);

function resetButton() {
    apple2plus.reset();
}

function restartButton() {
    apple2plus.restart();
}

function pauseButton() {
    if (appleIntervalHandle != null) {
        window.clearInterval(appleIntervalHandle);
        appleIntervalHandle = null;
        document.getElementById('pausebutton').value = 'Resume';
    } else {
        appleIntervalHandle = window.setInterval("appleIntervalFunc()",
                                                 appleIntervalTime);
        document.getElementById('pausebutton').value = 'Pause ';
    }
}

// Convert a DSK file to a NIB image.
//
function apple2ConvertDskToNib(dskBytes) {
    var sixTwo = [
        0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
        0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
        0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
        0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
        0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
        0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
        0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
        0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff ];
    var secSkew = [ 0, 7, 14, 6, 13, 5, 12, 4, 11, 3, 10, 2, 9, 1, 8, 15 ];
    var bytes = new Array(232960);
    var prenib = new Array(342);
    var offs;

    // Odd-even encoding for sector headers.
    function oddEven(b) {
        bytes[offs++] = 0xaa | (b >> 1);
        bytes[offs++] = 0xaa | b;
    }

    for (var track = 0; track < 35; track++) {
        offs = track * 6656;
        for (var sec = 0; sec < 16; sec++) {

            // "Sync" bytes.
            for (var i = 0; i < 20; i++)
                bytes[offs++] = 0xff;

            // Addr field prologue
            bytes[offs++] = 0xd5;
            bytes[offs++] = 0xaa;
            bytes[offs++] = 0x96;

            oddEven(254);               // Volume
            oddEven(track);
            oddEven(sec);
            oddEven(254 ^ track ^ sec); // checksum

            // Addr field epilogue
            bytes[offs++] = 0xde;
            bytes[offs++] = 0xaa;
            bytes[offs++] = 0xeb;

            // Sync bytes
            for (i = 0; i < 20; i++)
                bytes[offs++] = 0xff;

            // Data field prologue
            bytes[offs++] = 0xd5;
            bytes[offs++] = 0xaa;
            bytes[offs++] = 0xad;

            // Start by prenibbilizing
            var doffs = secSkew[sec] * 256 + track * 4096;
            for (i = 0; i < 256; i++) {
                var d8 = dskBytes[doffs + i];

                prenib[i] = (d8 >> 2);

                if (i < 86)
                    prenib[256 + 85 - i] =
                        ((d8 & 0x02) >> 1) | ((d8 & 0x01) << 1);
                else if (i < 172)
                    prenib[256 + 171 - i] |=
                        (((d8 & 0x02) << 1) | ((d8 & 0x01) << 3));
                else
                    prenib[256 + 257 - i] |=
                        (((d8 & 0x02) << 3) | ((d8 & 0x01) << 5));

                if (i < 2)
                    prenib[257 - i] |=
                        (((d8 & 0x02) << 3) | ((d8 & 0x01) << 5));
            }

            // Encode nibbilized data.
            var prev = 0;
            for (i = 0; i < 86; i++) {
                bytes[offs++] = sixTwo[prev ^ prenib[256 + 85 - i]];
                prev = prenib[256 + 85 - i];
            }
            for (i = 0; i < 256; i++) {
                bytes[offs++] = sixTwo[prev ^ prenib[i]];
                prev = prenib[i];
            }
            bytes[offs++] = sixTwo[prev];

            // Data field epilogue
            bytes[offs++] = 0xde;
            bytes[offs++] = 0xaa;
            bytes[offs++] = 0xeb;
        }

        // fill out with sync bytes.
        while (offs < (track + 1) * 6656)
            bytes[offs++] = 0xff;
    }

    return bytes;
}

function loadDisk() {
    var file = document.getElementById('loadfile').files[0];

    if (!file)
        return;

    var fread = new FileReader();
    fread.readAsArrayBuffer(file);
    fread.onload = function(levent) {
        var data = new DataView(levent.target.result);
        var size = levent.target.result.byteLength;

        var bytes = Array(size);
        for (var i = 0; i < size; i++)
            bytes[i] = data.getUint8(i);

        if (size == 143360)
            bytes = apple2ConvertDskToNib(bytes);

        apple2plus.loadDisk(bytes);
    }
}
