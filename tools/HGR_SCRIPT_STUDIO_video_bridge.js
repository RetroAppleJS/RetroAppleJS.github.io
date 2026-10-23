// HGR Script Studio - Phase 1: native Apple II video MUX / Canvas preview.
// Runs without a CPU, slots, video raster scheduler, or Apple2Hw.
if(typeof oEMU === "undefined")
    var oEMU = {component:{Video:{},ROM:{},IO:{}}};
else if(!oEMU.component)
    oEMU.component = {Video:{},ROM:{},IO:{}};
else {
    oEMU.component.Video ||= {};
    oEMU.component.ROM ||= {};
    oEMU.component.IO ||= {};
}

function HGRStudioVideoBridge(canvas)
{
    if(typeof Apple2VideoMUX !== "function" ||
       typeof Apple2VideoCanvas !== "function" ||
       typeof Apple2CharROM_get !== "function")
        throw Error("Native Canvas/MUX video dependencies are missing");

    // Addressed like the Apple II: page 1 $2000-$3FFF, page 2 $4000-$5FFF.
    // No CPU or full Apple2Hw instance is needed for static HGR display.
    const memory = new Uint8Array(0x6000);
    const mux = new Apple2VideoMUX(canvas);
    const hw = {
        safe_videodump(){return memory;},
        safe_flashdump(){return memory;}
    };

    // Reuse the editor's canvas. MUX must not replace it with a clone because
    // the editor's mouse handlers and selection overlay target this canvas.
    mux.canvases.canvas = canvas;
    mux.vidram = memory;
    mux.hw = hw;
    mux.reset();
    mux.setMix(false);
    mux.setGfx(true);
    mux.setHires(true);

    this.memory = memory;
    this.video = mux;
    this.canvas = canvas;

    this.render = function(hgrBytes,base,view)
    {
        if(!hgrBytes || hgrBytes.length !== 0x2000)
            throw Error("HGR video bridge expects 8192 bytes");
        if(base !== 0x2000 && base !== 0x4000)
            throw Error("HGR video bridge expects page $2000 or $4000");

        memory.set(hgrBytes,base);
        mux.setPage2(base === 0x4000);
        mux.setMonitor(view === "color" ? 0 : 1);
        mux.redraw();
    };

    this.getRendererName = function(){return mux.getRenderMode();};
}
