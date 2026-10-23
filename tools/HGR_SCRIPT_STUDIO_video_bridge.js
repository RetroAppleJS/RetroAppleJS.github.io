// HGR Script Studio video bridge - shared MUX renderers without a CPU.
// The editor owns its immutable 8K page; all renderers read the same mirrored
// 24K video memory. The MUX swaps only the dedicated #applescreen canvas.
if(typeof oEMU === "undefined")
    var oEMU = {component:{Video:{},ROM:{},IO:{}}};
else if(!oEMU.component)
    oEMU.component = {Video:{},ROM:{},IO:{}};
else {
    oEMU.component.Video ||= {};
    oEMU.component.ROM ||= {};
    oEMU.component.IO ||= {};
}

function HGRStudioVideoBridge(displayCanvas)
{
    if(typeof Apple2VideoMUX !== "function" ||
       typeof Apple2VideoCanvas !== "function" ||
       typeof Apple2CharROM_get !== "function")
        throw Error("Apple II video Canvas/MUX dependencies are missing");

    const memory = new Uint8Array(0x6000);
    const mux = new Apple2VideoMUX(displayCanvas);
    const hw = {
        safe_videodump(){return memory;},
        safe_flashdump(){return memory;}
    };

    // Important: the MUX clones new context-clean canvases for GPU backends.
    // Only its Canvas renderer reuses our bootstrap display canvas.
    // HGR Script Studio's #hgrCanvas is a separate transparent input layer.
    mux.canvases.canvas = displayCanvas;
    mux.vidram = memory;
    mux.hw = hw;

    // The emulator normally defaults to GPU.js. Standalone Studio must use
    // Canvas first, even if optional GPU libraries have been loaded.
    mux.modeIndex = mux.getRenderModeIndexByName("canvas");
    mux.reset();
    mux.setMix(false);
    mux.setGfx(true);
    mux.setHires(true);

    this.memory = memory;
    this.video = mux;
    this.canvas = displayCanvas;
    this.onModeChange = null;

    if(typeof mux.subscribeDeviceSelection === "function")
        mux.subscribeDeviceSelection(event => {
            if(typeof this.onModeChange === "function")
                this.onModeChange(event.mode);
        });

    let lastPage2 = false, lastChrome = 0;

    this.getModes = function()
    {
        return mux.getRenderModes().map(spec => spec.name);
    };

    this.getRendererName = function()
    {
        return mux.getRenderMode();
    };

    this.getDisplayCanvas = function()
    {
        return mux.canvas || displayCanvas;
    };

    this.setMode = function(mode)
    {
        const spec = mux.getRenderModeSpec(mode);
        if(!spec) throw Error("Unknown video renderer: "+mode);
        const renderer = mux.getRendererInstance(mode,true);
        if(!renderer || !renderer.id || !renderer.id.DCODE ||
           !mux.setModeByDCODE(renderer.id.DCODE,null,false))
            throw Error("Cannot activate renderer: "+mode);
        // Both the current HGR bytes and the display mode were retained.
        mux.redraw();
        return mux.getRenderMode();
    };

    this.render = function(hgrBytes,base,view)
    {
        if(!hgrBytes || hgrBytes.length !== 0x2000)
            throw Error("HGR video bridge expects 8192 bytes");
        if(base !== 0x2000 && base !== 0x4000)
            throw Error("HGR video bridge expects page $2000 or $4000");

        memory.set(hgrBytes,base);
        // Wave/YIQ caches a 7680-byte linearized HGR page; bulk writes bypass
        // its per-address write hook, so invalidate that cache explicitly.
        const active = mux.getActiveRenderer();
        if(active && typeof active.markDirty === "function") active.markDirty();
        const page2 = base === 0x4000;
        const chrome = view === "color" ? 0 : 1;
        if(page2 !== lastPage2) { mux.setPage2(page2); lastPage2 = page2; }
        if(chrome !== lastChrome) { mux.setMonitor(chrome); lastChrome = chrome; }
        mux.redraw();
    };
}
