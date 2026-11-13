// System model/configuration state for the SYSTEM toolbox.
// Only non-"-" SYSCODEs are emulatable. A multi-value field is a comma-
// separated set of *alternatives*, never a composite string.

var EMU_system_configState = { byModel:Object.create(null), active:null, error:"" };
var EMU_system_configFields = ["CPU","Speeds","Display","Slotslogphy","ROM","KeyFont"];

function EMU_system_modelCodes()
{
    if(typeof(_CFG_SYSCODE)==="undefined") return [];
    return Object.keys(_CFG_SYSCODE).filter(function(code){return code.charAt(0)!=="-";});
}

function EMU_system_options(code,field)
{
    if(EMU_system_modelCodes().indexOf(code)<0 || !EMU_system_configFields.includes(field)) return [];
    return String(_CFG_SYSCODE[code][field] || "")
        .split(",").map(function(s){return s.trim();}).filter(Boolean);
}

function EMU_system_getConfiguration(code)
{
    code=String(code || (typeof(EMU_system_get)==="function" ? EMU_system_get() : "A2P"));
    if(EMU_system_modelCodes().indexOf(code)<0) return null;
    var stored=EMU_system_configState.byModel[code] || {};
    var config={model:code};
    EMU_system_configFields.forEach(function(field)
    {
        var opts=EMU_system_options(code,field);
        config[field]=opts.indexOf(stored[field])>=0 ? stored[field] : (opts[0] || "");
    });
    return config;
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

function EMU_system_configError(message)
{
    EMU_system_configState.error=String(message || "");
    if(message) console.warn("Apple II system configuration: "+message);
    return false;
}

function EMU_system_validateConfiguration(config)
{
    if(!config || EMU_system_modelCodes().indexOf(config.model)<0)
        return "Unsupported Apple II system.";
    for(var i=0;i<EMU_system_configFields.length;i++)
    {
        var field=EMU_system_configFields[i],options=EMU_system_options(config.model,field);
        if(options.length && options.indexOf(config[field])<0)
            return "Invalid "+field+" option: "+config[field]+".";
    }
    // The current core implements the NMOS 6502 and Apple II/II+ hardware.
    // Advertising an alternative in COM_CONFIG does not add a CPU emulator.
    if(config.CPU!=="6502") return "CPU "+config.CPU+" is not yet emulated.";
    if(config.Speeds!=="1.023") return "Motherboard speed "+config.Speeds+" MHz is not yet emulated.";
    if(config.Display!=="A2_hgr") return "Display hardware "+config.Display+" is not yet emulated.";
    if(config.Slotslogphy!=="[0-7] [0-7]")
        return "Slot layout "+config.Slotslogphy+" is not yet emulated.";
    if(config.KeyFont &&
       (typeof(apple2CharRom)==="undefined" || !apple2CharRom[config.KeyFont]))
        return "Character ROM "+config.KeyFont+" is not loaded.";
    if(config.ROM && config.ROM!=="A2P_R" && config.ROM!=="A2P_RL" &&
       !(config.model==="A2JP" && config.ROM==="A2P_RJ"))
        return "Motherboard ROM "+config.ROM+" is not available.";
    return "";
}

function EMU_system_effectiveRom(config)
{
    // A2P_RJ is currently only a config-table placeholder; until a genuine
    // Japanese motherboard ROM is available, the original Apple II+ image
    // remains the fallback, exactly as in the existing J-Plus mode.
    return config && config.ROM==="A2P_RL" ? "A2P_RL" : "A2P_R";
}

// A ROM option list in _CFG_SYSCODE is NOT a ROM range key. Resolve the
// one active alternative, with J-Plus mapping to the existing A2P range.
function EMU_system_romRangeID(config)
{
    var selected=config || EMU_system_configState.active
        || EMU_system_getConfiguration();
    var romID=EMU_system_effectiveRom(selected);
    if(typeof(_CFG_ROMRANGES)==="undefined" || !_CFG_ROMRANGES[romID])
        throw new Error("No configured motherboard ROM range for "+romID);
    return romID;
}

// Keep the existing entry point, but centralize every ROM-byte mutation
// inside Apple2ROM() in EMU_apple2roms.js.
function EMU_system_patchRom(config)
{
    return Apple2ROM(EMU_system_romRangeID(config));
}

function EMU_system_configPersist(config)
{
    if(typeof(window)==="undefined" || !window.location || !window.history ||
       typeof(window.history.replaceState)!=="function") return;
    var next=new URL(window.location.href);
    next.searchParams.set("sys",config.model);
    EMU_system_configFields.forEach(function(field)
    {
        var param="sys_"+field.toLowerCase(),options=EMU_system_options(config.model,field);
        if(config[field] && config[field]!==options[0])
            next.searchParams.set(param,config[field]);
        else next.searchParams.delete(param);
    });
    window.history.replaceState(null,"",next.pathname+next.search+next.hash);
    if(typeof(oCOM)!=="undefined" && oCOM.URL && oCOM.URL.uri)
    {
        oCOM.URL.uri.sys=config.model;
        EMU_system_configFields.forEach(function(field)
        {
            var param="sys_"+field.toLowerCase(),options=EMU_system_options(config.model,field);
            if(config[field] && config[field]!==options[0]) oCOM.URL.uri[param]=config[field];
            else delete oCOM.URL.uri[param];
        });
    }
}

function EMU_system_configStartup()
{
    var model=typeof(EMU_system_get)==="function" ? EMU_system_get() : "A2P";
    if(EMU_system_modelCodes().indexOf(model)<0) model="A2P";
    var config=EMU_system_getConfiguration(model);
    var args=(typeof(oCOM)!=="undefined" && oCOM.URL) ? oCOM.URL.uri || {} : {};
    EMU_system_configFields.forEach(function(field)
    {
        var value=args["sys_"+field.toLowerCase()];
        if(value!==undefined && EMU_system_options(model,field).indexOf(value)>=0)
            config[field]=value;
    });
    var error=EMU_system_validateConfiguration(config);
    if(error)
    {
        EMU_system_configError(error+" Using model defaults.");
        config=EMU_system_getConfiguration(model);
    }
    EMU_system_applyModel(model);
    EMU_system_patchRom(config);
    EMU_system_configState.byModel[model]=Object.assign({},config);
    EMU_system_configState.active=Object.assign({},config);
    return config;
}

function EMU_system_selectConfiguration(code,choices)
{
    code=String(code || "");
    EMU_system_configState.error="";
    if(EMU_system_modelCodes().indexOf(code)<0)
        return EMU_system_configError("Unsupported Apple II system "+code+".");

    var config=EMU_system_getConfiguration(code);
    choices=choices || {};
    EMU_system_configFields.forEach(function(field)
    {
        if(Object.prototype.hasOwnProperty.call(choices,field)) config[field]=String(choices[field]);
    });
    var error=EMU_system_validateConfiguration(config);
    if(error) return EMU_system_configError(error);
    if(typeof(apple2plus)==="undefined" || !apple2plus ||
       typeof(apple2plus.restart)!=="function")
        return EMU_system_configError("The emulator is not running.");

    var current=EMU_system_configState.active ||
                EMU_system_getConfiguration(typeof(EMU_system_get)==="function"?EMU_system_get():"A2P");
    var changes=!current || EMU_system_configFields.some(function(field)
    {
        return current[field]!==config[field];
    }) || current.model!==config.model;
    if(!changes)
    {
        EMU_system_configPersist(config);
        return true;
    }

    if(typeof(window)!=="undefined" && typeof(window.confirm)==="function" &&
       !window.confirm("Apply "+_CFG_SYSCODE[code].Model+
          " configuration? This cold-boots the Apple II and clears RAM."))
        return EMU_system_configError("Configuration change cancelled.");

    var oldModel=typeof(EMU_system_get)==="function" ? EMU_system_get() : "A2P";
    var video=typeof(apple2plus.vidObj)==="function" ? apple2plus.vidObj() : null;
    var oldFont=video && typeof(video.getCharRomKey)==="function" ? video.getCharRomKey() : null;
    var oldRomByte=null;
    var oldActive=EMU_system_configState.active;
    try
    {
        oldRomByte=EMU_system_patchRom(config);
        EMU_system_applyModel(code);
        // Peripheral restart() routines must see the NEW selected ROM range,
        // not the previously running configuration.
        EMU_system_configState.active=Object.assign({},config);
        if(config.KeyFont && video && typeof(video.setCharRom)==="function" &&
           video.setCharRom(config.KeyFont)===false)
            throw new Error("Cannot activate character ROM "+config.KeyFont);
        apple2plus.restart();
    }
    catch(ex)
    {
        if(oldRomByte!==null)
            Apple2ROM(oldRomByte===0x05 ? "A2P_RL" : "A2P_R");
        EMU_system_configState.active=oldActive;
        EMU_system_applyModel(oldModel);
        if(oldFont && video && typeof(video.setCharRom)==="function")
            video.setCharRom(oldFont);
        if(typeof(system_tab_update)==="function") system_tab_update();
        return EMU_system_configError("Could not apply configuration: "+(ex.message || ex));
    }

    EMU_system_configState.byModel[code]=Object.assign({},config);
    EMU_system_configState.active=Object.assign({},config);
    EMU_system_configPersist(config);
    if(typeof(system_tab_update)==="function") system_tab_update();
    return true;
}

// Existing callers can still select by model alone.
function EMU_system_selectModel(code)
{
    return EMU_system_selectConfiguration(code);
}
