//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_DEVICE_video_text.js
//
// Semantic text-output device for the Apple II motherboard display.
// TxtCap pulls this endpoint instead of knowing Apple II text-page memory
// layout in index.html.
//

function Apple2VideoText()
{
    this.id = {
         "DCODE":"A2VIDEOTXT"
        ,"hostPCODE":"A2BO"
        ,"icon":"fa fa-tv"
        ,"description":"Apple II text video output"
    };

    this.ports = {
        "text":{
             "direction":"out"
            ,"mime":["text/plain"]
            ,"provider":"captureText"
            ,"description":"Apple II text page as plain text"
        }
    };

    this.captureText = function(request,context)
    {
        var hw = context && context.hw;

        if(!hw || typeof(hw.safe_flashdump)!="function")
            return false;

        var ram = hw.safe_flashdump();
        var video =
            typeof(oApple2Video)!="undefined"
                ? oApple2Video
                : null;

        var page2 = !!(
            video &&
            video.state &&
            video.state.page2===true
        );

        var base = page2 ? 0x0800 : 0x0400;
        var lines = [];

        for(var y=0;y<24;y++)
        {
            var line = "";

            for(var x=0;x<40;x++)
            {
                // Apple II 40-column text-page interleave.
                var adr =
                      base
                    + ((y-(y&0xF8)) << 7)
                    + (y&0xF8) * 5
                    + x;

                var b = ram[adr];

                /*
                 * Preserve the former TxtCap interpretation while moving it
                 * behind a semantic device boundary: normal Apple II+ display
                 * bytes $A0-$DF become ASCII $20-$5F; non-text attributes and
                 * unsupported cells become spaces.
                 */
                line += b>=0xA0 && b<=0xDF
                    ? String.fromCharCode(b-0x80)
                    : " ";
            }

            lines.push(line);
        }

        return {
             "mime":"text/plain"
            ,"data":lines.join("\n")
            ,"meta":{
                 "columns":40
                ,"rows":24
                ,"page":page2 ? 2 : 1
                ,"base":base
            }
        };
    };
}