// AY0 and AY1 are independent mounted sound-source devices. Their chip slices
// share one block core; the Mockingboard owns VIA/bus timing and the stereo sink.
function AYChipDevice(options)
{
    options = options || {};
    var device = this;
    var index =
        options.chipIndex === undefined ? Number(options.deviceN || 1) - 1 : options.chipIndex;
    if (!AYCore.integer(index, 0, 1))
        throw AYCore.error("E_ARGUMENT");
    var core = null, owner = null, enabled = true, mix = [ 0, 0, 0, 0, 0, 0 ];
    var silentMix = [ 0, 0, 0, 0, 0, 0 ];
    this.soundSourceDevice = true;
    this.id = {
        DCODE : "AY8910",
        coID : "AYChipDevice",
        hostPCODE : "MOCK",
        deviceN : index + 1,
        icon : "fa fa-music",
        description : "AY" + index + " — three-channel sound source"
    };

    this.bindCore = function(next) {
        core = next;
        if (core)
            core.setMix(index, enabled ? mix : silentMix);
    };
    this.configure = function(model, clockHz) {
        core.configureChip(index, {model : model, clockHz : clockHz});
    };
    this.setMix = function(weights) {
        mix = Array.from(weights);
        if (core)
            core.setMix(index, enabled ? mix : silentMix);
    };
    this.writeNow = function(reg, value) {
        if (core)
            core.writeNow(index, reg, value);
    };
    this.acceptWrite = function(reg, value, cpuTick) {
        if (typeof (options.onSoundEvent) === "function")
            options.onSoundEvent(0, reg, value, cpuTick);
    };
    this.acceptReset = function(cpuTick) {
        if (typeof (options.onSoundEvent) === "function")
            options.onSoundEvent(1, 0, 0, cpuTick);
    };
    this.getRegisters = function() {
        if (typeof (options.getRegisters) === "function")
            return options.getRegisters();
        var result = new Uint8Array(14);
        if (core)
            core.getRegisters(index, result);
        return result;
    };
    this.getState = function() {
        return {
            chipIndex : index,
            channels : 3,
            enabled : enabled,
            attached : !!owner,
            backend : core ? core.backend : null
        };
    };
    this.bindHost = function(host) {
        if (!host || host.id?.PCODE !== "MOCK" || typeof (host.getAYDevice) !== "function" ||
            host.getAYDevice(index) !== device)
            return false;
        owner = host;
        enabled = true;
        if (core)
            core.setMix(index, mix);
        return true;
    };
    this.unbindHost = function(host) {
        if (owner !== host)
            return false;
        enabled = false;
        if (core)
            core.setMix(index, silentMix);
        owner = null;
        return true;
    };
}

// The embedded module is small and cached. Synchronous construction lets the
// peripheral start in WASM immediately, before any CPU writes are accepted.
AYChipDevice.createCore = function(options, backend) {
    if (backend === "js")
        return AYCore.createJS(options);
    AYCoreWASM.initializeSync();
    return AYCore.facade(AYCoreWASM.createReady(AYCore.configuration(options)), "wasm", "");
};
