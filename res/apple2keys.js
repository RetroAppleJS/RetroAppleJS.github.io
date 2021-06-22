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

// apple2keys.js

function apple2OnKeyPress(event) {
    if (event.metaKey || event.altKey)
      return true;

    var code = event.charCode != 0 ? event.charCode : event.keyCode;
    //console.log("apple2OnKeyPress: code=0x%s", code.toString(16));
    //alert("apple2OnKeyPress: code=0x"+code.toString(16))

    // left arrow
    if (event.charCode == 0 && event.keyCode == 37)
        code = 0x08;

    // right arrow
    if (event.charCode == 0 && event.keyCode == 39)
        code = 0x15;

    // Convert lower case to upper case
    if (code >= 0x61 && code <= 0x7a)
        code -= 0x20;

    // Apple control key on alpha characters
    if (event.ctrlKey && code >= 0x41 && code <= 0x5a)
        code -= 0x40;

    // Hi bit is always set
    code |= 0x80;
    apple2plus.keypress(code);

    return false;
}
