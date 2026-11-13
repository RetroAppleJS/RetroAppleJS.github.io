// Supported motherboard models for the SYSTEM toolbox (tab 1.1).
// Entries prefixed with "-" in COM_CONFIG.js are documentation only.

function EMU_system_modelCodes()
{
    if(typeof(_CFG_SYSCODE)==="undefined") return [];
    return Object.keys(_CFG_SYSCODE).filter(function(code)
    {
        return code.charAt(0)!=="-";
    });
}

function EMU_system_applyModel(code)
{
    code=String(code || "");
    var codes=EMU_system_modelCodes();
    if(codes.indexOf(code)<0) return false;

    for(var i=0;i<codes.length;i++)
    {
        var name=codes[i];
        if(!oEMU.system[name] || typeof(oEMU.system[name])!=="object")
            oEMU.system[name]={};
        oEMU.system[name].active=(name===code);
    }

    if(typeof(_TABS)!=="undefined")
        for(var tab in _TABS)
        {
            _TABS[tab].DEF_SYS=code;
            _TABS[tab].SYS=code;
        }
    return true;
}

function EMU_system_selectModel(code)
{
    code=String(code || "");
    if(EMU_system_modelCodes().indexOf(code)<0)
    {
        if(typeof(system_tab_update)==="function") system_tab_update();
        return false;
    }

    var previous=typeof(EMU_system_get)==="function" ? EMU_system_get() : "A2P";
    if(previous===code) return true;
    if(typeof(apple2plus)==="undefined" || !apple2plus ||
       typeof(apple2plus.restart)!=="function")
        return false;

    // A model change must not leave RAM, ProDOS or peripherals running under
    // a different machine definition. Ask first because restart clears RAM.
    if(typeof(window)!=="undefined" && typeof(window.confirm)==="function" &&
       !window.confirm("Change to "+_CFG_SYSCODE[code].Model+
                       "? This cold-boots the Apple II and clears RAM. Continue?"))
    {
        if(typeof(system_tab_update)==="function") system_tab_update();
        return false;
    }

    var video=typeof(apple2plus.vidObj)==="function" ? apple2plus.vidObj() : null;
    var previousFont=video && typeof(video.getCharRomKey)==="function" ? video.getCharRomKey() : null;
    var modelFont=String(_CFG_SYSCODE[code].KeyFont || "").split(",")[0].trim();

    EMU_system_applyModel(code);
    try
    {
        if(modelFont && video && typeof(video.setCharRom)==="function" &&
           video.setCharRom(modelFont)===false)
            throw new Error("Character ROM not available: "+modelFont);
        apple2plus.restart();
    }
    catch(error)
    {
        EMU_system_applyModel(previous);
        if(previousFont && video && typeof(video.setCharRom)==="function")
            video.setCharRom(previousFont);
        if(typeof(system_tab_update)==="function") system_tab_update();
        console.error("Apple II model change failed",error);
        return false;
    }

    // Keep the selected model across an ordinary page reload without losing
    // other URL settings (disk image, slots, selected tab, etc.).
    if(typeof(window)!=="undefined" && window.history &&
       typeof(window.history.replaceState)==="function" && window.location)
    {
        var next=new URL(window.location.href);
        next.searchParams.set("sys",code);
        window.history.replaceState(null,"",next.pathname+next.search+next.hash);
        if(typeof(oCOM)!=="undefined" && oCOM.URL && oCOM.URL.uri)
            oCOM.URL.uri.sys=code;
    }

    if(typeof(system_tab_update)==="function") system_tab_update();
    return true;
}
