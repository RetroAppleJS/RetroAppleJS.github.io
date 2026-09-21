'use strict';

const fs=require('node:fs');

function replaceOnce(source,needle,replacement,label)
{
    const first=source.indexOf(needle);
    if(first<0) throw new Error('Missing '+label);
    if(source.indexOf(needle,first+needle.length)>=0) throw new Error('Ambiguous '+label);
    return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

{
    const file='res/EMU_apple2io.js';
    let source=fs.readFileSync(file,'utf8');
    source=replaceOnce(
        source,
`            var deviceInfo=deviceConfig[deviceN];
            if(deviceInfo && deviceInfo.autoAttach!==false)
                this.attach(owner,deviceInfo);`,
`            var deviceInfo=deviceConfig[deviceN];
            if(!deviceInfo || deviceInfo.autoAttach===false) continue;

            if(deviceInfo.autoAttach==="if-empty")
            {
                var mountedDevices=Array.isArray(owner.devices) ? owner.devices : [];
                if(mountedDevices.length>0) continue;
            }

            this.attach(owner,deviceInfo);`,
        'provisionPeripheral autoAttach block'
    );
    fs.writeFileSync(file,source);
}

{
    const file='res/EMU_DEVICE_HD20.js';
    let source=fs.readFileSync(file,'utf8');
    source=replaceOnce(source,'        if(!name) return "HD20.po";','        if(!name) return "UNFORMATTED-HD20.po";','poFilename blank fallback');
    source=replaceOnce(source,'        return (name || "HD20")+".po";','        return (name || "UNFORMATTED-HD20")+".po";','poFilename sanitized fallback');
    source=replaceOnce(source,'        return "HD20.po";','        return "UNFORMATTED-HD20.po";','suggestedFilename blank fallback');
    fs.writeFileSync(file,source);
}
