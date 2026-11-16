// ProDOS 8 offline boot: frame-driven State Machine (DISKII S6,D1).
// A new RUN creates ctx.data; it persists across every frame and state.
// PAUSE freezes process execution; STOP cancels it.
// A 60-second per-state deadline prevents indefinite waits.
const initialState = "mountDisk";
const stateTimeoutMs = 60000;
const states = {
    mountDisk: async ({ apple, data, console }) => {
        data.disk = "disks/ProDOS 8.dsk";
        data.history = [];
        data.menuChecks = 0;
        data.basicChecks = 0;
        data.outputChecks = 0;
        await apple.script.hide();
        await apple.cpu.setSpeed(400);
        console.log("Mounting embedded ProDOS 8 in S6,D1 (CPU 400%)...");
        data.diskInfo = await apple.disk.loadOffline({
            slot: 6, drive: 1, path: data.disk
        });
        data.history.push("mounted");
        return "reboot";
    },

    reboot: async ({ apple, data, console }) => {
        await apple.reboot();
        console.log("Rebooting; waiting for the Bitsy Bye RETURN: menu...");
        data.history.push("reboot");
        return "waitForBootMenu";
    },

    waitForBootMenu: async ({ apple, data, console }) => {
        data.menuChecks++;
        // Bitsy Bye need not poll $C000 continuously. Inspect visible
        // screen text instead of inserting probe keys or blocking.
        const screen = await apple.text.capture();
        if (!/RETURN\s*:/i.test(screen)) return;
        const status = await apple.text.status();
        if (!status.inputOpen)
            throw new Error("Bitsy Bye is visible, but the text input port is closed.");
        console.log("Bitsy Bye menu detected; input port:", status.target);
        data.history.push("menu ready");
        return "selectBasicSystem";
    },

    selectBasicSystem: async ({ apple, data, console }) => {
        // Apple II RIGHT = $15 (CTRL-U). Select BASIC.SYSTEM.
        await apple.text.type("\x15\x15\r");
        data.history.push("right, right, return");
        console.log("Sent RIGHT, RIGHT, RETURN");
        return "drainMenuKeys";
    },

    drainMenuKeys: async ({ apple }) => {
        const status = await apple.text.status();
        if (status.queued !== 0 || status.latched) return;
        return "waitForBasicPrompt";
    },

    waitForBasicPrompt: async ({ apple, data, console }) => {
        data.basicChecks++;
        const screen = await apple.text.capture();
        if (!/(?:^|\n)\s*]/.test(screen)) return;
        const status = await apple.text.status();
        if (!status.inputOpen)
            throw new Error("BASIC prompt is visible, but the text input port is closed.");
        console.log("BASIC.SYSTEM is ready");
        data.history.push("BASIC.SYSTEM prompt");
        return "typeHelloWorld";
    },

    typeHelloWorld: async ({ apple, data }) => {
        await apple.text.type('PRINT "HELLO WORLD"\r');
        data.history.push('PRINT "HELLO WORLD"');
        return "drainBasicKeys";
    },

    drainBasicKeys: async ({ apple }) => {
        const status = await apple.text.status();
        if (status.queued !== 0 || status.latched) return;
        return "verifyOutput";
    },

    verifyOutput: async ({ apple, data }) => {
        data.outputChecks++;
        const screen = await apple.text.capture();
        // Match the output line, not the echoed PRINT command.
        if (!/(?:^|\n)\s*HELLO WORLD\s*(?:\n|$)/i.test(screen)) return;
        data.outputVerified = true;
        data.history.push("HELLO WORLD verified");
        return "finish";
    },

    finish: async ({ apple, data, console }) => {
        await apple.cpu.setSpeed(100);
        await apple.script.show();
        console.log("ProDOS BASIC.SYSTEM demonstration complete.", data.history);
        return { done: true };
    }
};
