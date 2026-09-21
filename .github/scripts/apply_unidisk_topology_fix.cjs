'use strict';

const fs=require('node:fs');

function replaceOnce(file,needle,replacement,label)
{
    let source=fs.readFileSync(file,'utf8');
    const first=source.indexOf(needle);
    if(first<0) throw new Error('Missing '+label+' in '+file);
    if(source.indexOf(needle,first+needle.length)>=0) throw new Error('Ambiguous '+label+' in '+file);
    source=source.slice(0,first)+replacement+source.slice(first+needle.length);
    fs.writeFileSync(file,source);
}

replaceOnce(
    'res/EMU_DEVICE_UNIDISK35.js',
`    this.getFirmwareVersion = function() { return FW_VERSION; };
    this.getName = function() { return DEVICE_NAME; };
`,
`    this.getFirmwareVersion = function() { return FW_VERSION; };
    this.getName = function() { return DEVICE_NAME; };
    this.getImage = function() { return media===null ? null : media.slice(); };
    this.getSuggestedFilename = function()
    {
        var name=String(state.mediaFilename || "").split(/[\\\\/]/).pop();
        return name || "UNIDISK35.po";
    };
`,
    'UniDisk export API'
);

replaceOnce(
    'res/EMU_CARD_LIRON.js',
`            var deviceCode=String(device.id?.DCODE || "SMARTPORT");
            var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || "HD20.po") : undefined;
            var hardDisk=deviceCode==="HD20";
`,
`            var deviceCode=String(device.id?.DCODE || "SMARTPORT");
            var hardDisk=deviceCode==="HD20";
            var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
            var deviceState=typeof(device.getState)==="function" ? device.getState() || {} : {};
            var downloadable=exportable && (hardDisk || !!deviceState.mediaLoaded);
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK35.po")) : undefined;
`,
    'Liron exportability block'
);

replaceOnce(
    'res/EMU_CARD_LIRON.js',
`                ,"downloadDisabled":!exportable
                ,"downloadOnClick":exportable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : undefined
                ,"downloadTitle":exportable ? ("Save "+logicalFilename) : "Save disk (not implemented yet)"
`,
`                ,"downloadDisabled":!downloadable
                ,"downloadOnClick":downloadable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : undefined
                ,"downloadTitle":downloadable ? ("Save "+logicalFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")
`,
    'Liron download row block'
);

replaceOnce(
    'res/EMU_CARD_LIRON.js',
`    this.reset = function() { iwm.reset(); };
    this.restart = function() { iwm.restart(); };
`,
`    var topologyRestartPending=false;
    this.onDeviceTopologyChanged = function(change)
    {
        if(topologyRestartPending) return true;
        topologyRestartPending=true;
        console.warn("Liron SmartPort topology changed; restarting the Apple II so ProDOS can rebuild its device table.",change || {});

        var restartHost=function()
        {
            topologyRestartPending=false;
            if(typeof(apple2plus)==="object" && apple2plus && typeof(apple2plus.restart)==="function")
                apple2plus.restart();
        };

        if(typeof(setTimeout)==="function") setTimeout(restartHost,0);
        else restartHost();
        return true;
    };

    this.reset = function() { iwm.reset(); };
    this.restart = function() { iwm.restart(); };
`,
    'Liron topology restart hook'
);

replaceOnce(
    'res/EMU_apple2io.js',
`        this.notifyPipeStateChange({
             "type":"attach"
            ,"DCODE":dcode
            ,"hostPCODE":hostPCODE
            ,"instanceID":attachHash
        });

        if(bDebug)
`,
`        this.notifyPipeStateChange({
             "type":"attach"
            ,"DCODE":dcode
            ,"hostPCODE":hostPCODE
            ,"instanceID":attachHash
        });

        if(newInstance && typeof(owner.onDeviceTopologyChanged)==="function")
        {
            try
            {
                owner.onDeviceTopologyChanged({
                     "type":"attach"
                    ,"DCODE":dcode
                    ,"device":device
                    ,"instanceID":attachHash
                });
            }
            catch(e) { console.error("Device topology attach notification failed",e); }
        }

        if(bDebug)
`,
    'Apple2IO attach topology hook'
);

replaceOnce(
    'res/EMU_apple2io.js',
`            delete this.attachments[key];
            removed = true;
`,
`            delete this.attachments[key];
            removed = true;

            if(typeof(owner.onDeviceTopologyChanged)==="function")
            {
                try
                {
                    owner.onDeviceTopologyChanged({
                         "type":"detach"
                        ,"DCODE":device?.id?.DCODE || DCODE || ""
                        ,"device":device
                        ,"instanceID":Number(device?.attach?.hash)
                    });
                }
                catch(e) { console.error("Device topology detach notification failed",e); }
            }
`,
    'Apple2IO detach topology hook'
);
