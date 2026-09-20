from pathlib import Path


def function_span(text,name):
    marker='function '+name+'('
    start=text.index(marker)
    brace=text.index('{',start)
    depth=0
    quote=''
    escape=False
    for i in range(brace,len(text)):
        ch=text[i]
        if quote:
            if escape:
                escape=False
            elif ch=='\\':
                escape=True
            elif ch==quote:
                quote=''
            continue
        if ch in ('"',"'",'`'):
            quote=ch
            continue
        if ch=='{':
            depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                return start,i+1
    raise RuntimeError('unterminated function '+name)

main_path=Path('res/EMU_apple2main.js')
s=main_path.read_text()

insert_at=s.index('function EMU_unidisk35Device(')
generic='''function EMU_smartportDevice(slotN,unit,deviceID)
{
    if(typeof(apple2plus)!="object" || !apple2plus) return null;
    var io=apple2plus.hwObj().io;
    if(!io) return null;

    var dcode=String(deviceID || "").toUpperCase();
    if(!dcode) return null;

    var hasUnit=unit!==undefined && unit!==null && unit!=="";
    var requestedUnit=Number(unit);
    if(hasUnit && (!Number.isInteger(requestedUnit) || requestedUnit<1 || requestedUnit>8))
        return null;

    function deviceUnit(device)
    {
        if(device && typeof(device.getUnit)==="function")
            return Number(device.getUnit());
        return Number(device && device.id ? device.id.deviceN : NaN);
    }

    function matches(device)
    {
        return device && device.id?.DCODE===dcode &&
            (!hasUnit || deviceUnit(device)===requestedUnit);
    }

    if(slotN!==undefined && slotN!==null && Number.isInteger(Number(slotN)))
    {
        var owner=io.SLOT2obj(Number(slotN));
        if(owner && owner.id?.PCODE==="LIRON" && Array.isArray(owner.devices))
        {
            var slotMatches=owner.devices.filter(matches);
            return slotMatches.length===1 ? slotMatches[0] : null;
        }
        return null;
    }

    var devices=typeof(io.DCODE2obj)==="function"
        ? io.DCODE2obj(dcode,"LIRON")
        : [];
    if(hasUnit) devices=devices.filter(matches);
    return devices.length===1 ? devices[0] : null;
}

'''
if 'function EMU_smartportDevice(' not in s:
    s=s[:insert_at]+generic+s[insert_at:]

start,end=function_span(s,'EMU_mountDiskImage')
router='''function EMU_mountDiskImage(arr_buffer,slotN,deviceID,filepath,unit)
{
    var bytes=arr_buffer instanceof Uint8Array
        ? arr_buffer
        : new Uint8Array(arr_buffer || []);
    var targetCode=String(deviceID||"").toUpperCase();
    var smartport=null;

    if(targetCode==="HD20")
    {
        smartport={
             "code":"HD20"
            ,"label":"Apple Hard Disk 20"
            ,"expectedBytes":20971520
            ,"device":EMU_smartportDevice(slotN,unit,"HD20")
        };
    }
    else if(targetCode==="UNIDISK35" || bytes.length===819200)
    {
        smartport={
             "code":"UNIDISK35"
            ,"label":"UniDisk 3.5"
            ,"expectedBytes":819200
            ,"device":EMU_unidisk35Device(slotN,unit)
        };
    }

    if(smartport)
    {
        var details={"slotN":slotN,"unit":unit,"filename":filepath || "","bytes":bytes.length};
        if(bytes.length!==smartport.expectedBytes)
        {
            console.error(smartport.label+" mount failed: invalid image size",{
                 "slotN":slotN
                ,"unit":unit
                ,"filename":filepath || ""
                ,"expected":smartport.expectedBytes
                ,"actual":bytes.length
            });
            return false;
        }

        var target=smartport.device;
        if(!target)
        {
            console.error(smartport.label+" mount failed: target device not found",details);
            return false;
        }
        if(typeof(target.loadImage)!=="function")
        {
            console.error(smartport.label+" mount failed: target device cannot load images",details);
            return false;
        }
        try { target.loadImage(bytes,{"filename":filepath || ""}); }
        catch(err)
        {
            console.error(smartport.label+" mount failed: device load exception",details,err);
            throw err;
        }
        console.log(smartport.label+" mount succeeded",details);

        // Compare the browser-router object with the exact SmartPort resident.
        try
        {
            var io=typeof(apple2plus)==="object" && apple2plus
                ? apple2plus.hwObj().io
                : null;
            var liron=io && Number.isInteger(Number(slotN))
                ? io.SLOT2obj(Number(slotN))
                : null;
            var lironUnitDevice=null;
            if(liron && liron.id?.PCODE==="LIRON" && typeof(liron.getBus)==="function")
            {
                var lironBus=liron.getBus();
                if(lironBus && typeof(lironBus.getDevice)==="function")
                    lironUnitDevice=lironBus.getDevice(Number(unit));
            }

            var routerState=typeof(target.getState)==="function"
                ? target.getState() || {}
                : {};
            var lironUnitState=lironUnitDevice && typeof(lironUnitDevice.getState)==="function"
                ? lironUnitDevice.getState() || {}
                : {};

            console.log(smartport.label+" identity trace",{
                 "slotN":slotN
                ,"unit":unit
                ,"sameObject":target===lironUnitDevice
                ,"routerDevice":target
                ,"lironUnitDevice":lironUnitDevice
                ,"routerState":{
                     "mediaLoaded":!!routerState.mediaLoaded
                    ,"mediaFilename":routerState.mediaFilename || ""
                }
                ,"lironUnitState":{
                     "mediaLoaded":!!lironUnitState.mediaLoaded
                    ,"mediaFilename":lironUnitState.mediaFilename || ""
                }
            });
        }
        catch(traceErr)
        {
            console.warn(smartport.label+" identity trace failed",traceErr);
        }
        return true;
    }

    var disk2=EMU_slotPeripheral(slotN,"DISKII");
    if(!disk2 || disk2.getState().active==false) return false;

    var diskBytes=Array.from(bytes);
    if(diskBytes.length===143360) diskBytes=disk2.convertDsk2Nib(diskBytes);
    return apple2plus.loadDisk(diskBytes,deviceID,slotN)!==false;
}'''
s=s[:start]+router+s[end:]
main_path.write_text(s)

liron_path=Path('res/EMU_CARD_LIRON.js')
s=liron_path.read_text()

start=s.index('    this.deviceToolLoadFile = function(input,unit)')
brace=s.index('{',start)
depth=0
quote=''
escape=False
end=None
for i in range(brace,len(s)):
    ch=s[i]
    if quote:
        if escape: escape=False
        elif ch=='\\': escape=True
        elif ch==quote: quote=''
        continue
    if ch in ('"',"'",'`'):
        quote=ch
        continue
    if ch=='{': depth+=1
    elif ch=='}':
        depth-=1
        if depth==0:
            semi=s.find(';',i)
            end=semi+1
            break
if end is None: raise SystemExit('deviceToolLoadFile end not found')

loadfn='''    this.deviceToolLoadFile = function(input,unit)
    {
        var file=input && input.files && input.files[0];
        if(!file) return false;

        unit=Number(unit);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(slotN))
            return false;

        function deviceUnit(device)
        {
            return device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
        }

        var target=smartport.getDevice(unit);
        if(!target)
        {
            var attached=Array.isArray(liron.devices) ? liron.devices : [];
            for(var i=0;i<attached.length;i++)
                if(deviceUnit(attached[i])===unit) { target=attached[i]; break; }
        }

        // Keep direct legacy calls compatible even when a test/tool invokes the
        // loader before the resident list has been populated.
        var deviceCode=String(target && target.id ? target.id.DCODE || "" : "") || "UNIDISK35";
        var mediaLabel=deviceCode==="UNIDISK35"
            ? "UniDisk 3.5"
            : (deviceCode==="HD20" ? "Apple Hard Disk 20" : deviceCode);
        var blockSize=target && typeof(target.getBlockSize)==="function"
            ? Number(target.getBlockSize())
            : 512;
        var blockCount=target && typeof(target.getBlockCount)==="function"
            ? Number(target.getBlockCount())
            : (deviceCode==="HD20" ? 40960 : 1600);
        var expectedBytes=blockSize*blockCount;

        function clearInput()
        {
            try { input.value=""; } catch(e) {}
        }

        if(!Number.isInteger(expectedBytes) || expectedBytes<=0 || Number(file.size)!==expectedBytes)
        {
            console.error(mediaLabel+" load failed: invalid image size",{
                 "slotN":slotN
                ,"unit":unit
                ,"filename":file.name || ""
                ,"expected":expectedBytes
                ,"actual":Number(file.size)
            });
            if(typeof(alert)==="function")
                alert(mediaLabel+" image must contain exactly "+expectedBytes+" bytes.");
            clearInput();
            return false;
        }

        var reader=new FileReader();
        reader.onload=function(ev)
        {
            try
            {
                var bytes=new Uint8Array(ev.target.result);
                var mounted=typeof(EMU_mountDiskImage)==="function" &&
                    EMU_mountDiskImage(bytes,slotN,deviceCode,file.name || "",unit);
                if(!mounted)
                {
                    console.error(mediaLabel+" load failed: mount rejected",{"slotN":slotN,"unit":unit,"filename":file.name || "","bytes":bytes.length});
                    if(typeof(alert)==="function") alert(mediaLabel+" load failed: mount rejected.");
                    clearInput();
                    return;
                }

                if(typeof(apple2plus)==="object" && apple2plus)
                {
                    var io=apple2plus.hwObj().io;
                    if(io && typeof(io.refreshDeviceToolboxes)==="function")
                        io.refreshDeviceToolboxes({
                             "id":"devices"
                            ,"default_slot":typeof(io.slot2ID)==="function"
                                ? io.slot2ID(slotN)
                                : undefined
                        });
                }
            }
            catch(err)
            {
                clearInput();
                console.error(mediaLabel+" load failed: exception",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":err && err.message ? err.message : String(err)},err);
                if(typeof(alert)==="function") alert(mediaLabel+" load failed: "+(err && err.message ? err.message : err));
            }
        };
        reader.onerror=function()
        {
            var msg=reader.error && reader.error.message ? reader.error.message : "Unable to read file.";
            clearInput();
            console.error(mediaLabel+" load failed: FileReader error",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":msg});
            if(typeof(alert)==="function") alert(mediaLabel+" load failed: "+msg);
        };
        reader.readAsArrayBuffer(file);
        return true;
    };'''
s=s[:start]+loadfn+s[end:]

old='''                ,"fileName":"UNIDISK35_"+unit
                ,"buttonTitle":"Unit"+unit+": eject disk"'''
new='''                ,"fileName":String(device.id?.DCODE || "SMARTPORT")+"_"+unit
                ,"buttonTitle":"Unit"+unit+": eject disk"'''
if old not in s: raise SystemExit('deviceToolSlotHTML fileName block not found')
s=s.replace(old,new,1)
liron_path.write_text(s)
