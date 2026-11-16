// State Machine: capture only changed HGR1 screens for five seconds.
// Processing is paced by the emulator's existing FPS setting (10 fps default).
// The graphics recorder stores compact page bytes, not bitmaps or GIF frames.
const initialState = "initialize";
const stateTimeoutMs = 20000;
const states = {
    initialize: async ({apple, data, console}) => {
        await apple.graphics.clear();
        data.captured = 0;
        data.skipped = 0;
        console.log("Recording HGR1 changes for five seconds...");
        return "record";
    },

    record: async ({apple, data, stateElapsedMs}) => {
        const result = await apple.graphics.capture({
            mode: "HGR", changedOnly: true
        });
        if (result.captured) data.captured++;
        else data.skipped++;

        // Uses the state-machine clock, which freezes on PAUSE.
        if (stateElapsedMs >= 5000) return "export";
    },

    export: async ({apple, data, console}) => {
        const summary = await apple.graphics.exportAnimatedGIF({
            filename: "apple2-hgr-recording.gif",
            loop: 0,               // GIF Netscape extension: repeat forever
            lastDelayMs: 250
        });
        console.log("Animated GIF saved:", summary);
        console.log("Frames captured:",data.captured,
            "Unchanged frames ignored:",data.skipped);
        return {done:true};
    }
};

// For an individual still GIF in any script:
// await apple.graphics.capture({mode:"HGR2"});
// await apple.graphics.exportGIF({filename:"hgr2.gif"});
// Also available: GR, GR2, HGR, HGR2 and mode:"active".
