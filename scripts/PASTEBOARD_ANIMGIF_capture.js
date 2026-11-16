
const initialState = "record";
const stateTimeoutMs = 300000;

const MAX_FRAMES = 100;

const states = {

    record: async ({ apple, data, console }) =>
    {

        // Initialize once
        if (!data.initialized)
        {
            await apple.graphics.clear();
            data.frames = 0;
            data.initialized = true;

            console.log("GIF recording started");
            console.log("Target:", MAX_FRAMES, "frames");
            console.log("Mode:", await apple.graphics.mode());
        }

        // Capture one frame per state-machine cycle
        const result = await apple.graphics.capture({
            mode: "active",
            changedOnly: false
        });

        if (result.captured)
        {
            data.frames++;

            // Show recording progress
            if (data.frames % 10 === 0)
            {
                console.log(
                    "Captured", data.frames,
                    "of", MAX_FRAMES
                );
            }
        }

        // Keep collecting frames
        if (data.frames < MAX_FRAMES)
        {
            return;
        }

        // Export once, after frame 100
        console.log("Encoding animated GIF...");

        const gif = await apple.graphics.exportAnimatedGIF({
            filename: "AppleII_100frames.gif",
            frameDelayMs: 100,
            lastDelayMs: 100,
            loop: 0
        });

        console.log("Download:", gif.filename);
        console.log("Frames:", gif.frames);
        console.log("Size:", gif.bytes, "bytes");

        return { done: true };
    }

};
