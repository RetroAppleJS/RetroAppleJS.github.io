// Emulated Apple Hard Disk 20 logical SmartPort device for RetroAppleJS.
// This is exposed to the Apple II through the Liron SmartPort host.

function HD20Device(options)
{
    options = options || {};

    const BLOCK_SIZE = 512;
    const BLOCK_COUNT = 40960; // 20 MiB
    const DEVICE_TYPE = 0x02;  // SmartPort hard disk
    const DEVICE_SUBTYPE = 0x20; // non-removable hard disk
    const FW_VERSION = options.firmwareVersion===undefined ? 0x0100 : Number(options.firmwareVersion)&0xFFFF;
    const DEVICE_NAME = String(options.name===undefined ? "HARD DISK 20" : options.name).slice(0,16);

    var state = {
         unit:0
        ,online:options.online===undefined ? true : !!options.online
        ,writeProtected:!!options.writeProtected
        ,mediaFilename:""
    };

    var media = null;
    var host = null;

    this.id = {
         "DCODE":"HD20"
        ,"hostPCODE":"LIRON"
        ,"icon":"fa fa-hdd"
        ,"description":"Apple Hard Disk 20"
    };

    this.ports = {
        "smartport":{
             "label":"SmartPort"
            ,"kind":"bus"
            ,"direction":"bidirectional"
            ,"protocol":"SmartPort"
            ,"unit":null
            ,"visibility":"public"
        }
    };

    function statusByte()
    {
        // Block device, writable/readable, format capable; online is dynamic.
        var value = 0xE8;
        if(state.online) value |= 0x10;
        if(state.writeProtected) value |= 0x04;
        return value & 0xFF;
    }

    function putBlockCount(out,offset)
    {
        out[offset]   = BLOCK_COUNT & 0xFF;
        out[offset+1] = (BLOCK_COUNT >> 8) & 0xFF;
        out[offset+2] = (BLOCK_COUNT >> 16) & 0xFF;
    }

    function deviceStatus()
    {
        var out = new Uint8Array(4);
        out[0] = statusByte();
        putBlockCount(out,1);
        return out;
    }

    function deviceInformationBlock()
    {
        var out = new Uint8Array(25);
        out.fill(0x20,5,21);

        out[0] = statusByte();
        putBlockCount(out,1);
        out[4] = DEVICE_NAME.length;
        for(var i=0;i<DEVICE_NAME.length;i++) out[5+i] = DEVICE_NAME.charCodeAt(i)&0x7F;
        out[21] = DEVICE_TYPE;
        out[22] = DEVICE_SUBTYPE;
        out[23] = FW_VERSION & 0xFF;
        out[24] = (FW_VERSION >> 8) & 0xFF;
        return out;
    }

    this.bindHost = function(owner)
    {
        if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachSmartPortDevice)!=="function")
            return false;
        if(host && host!==owner) return false;
        if(owner.attachSmartPortDevice(this)!==this) return false;
        host=owner;
        return true;
    };

    this.unbindHost = function(owner)
    {
        if(!host) return true;
        if(owner && owner!==host) return false;
        if(typeof(host.detachSmartPortDevice)!=="function") return false;
        if(host.detachSmartPortDevice(this)===false) return false;
        host=null;
        return true;
    };

    this.setUnit = function(unit)
    {
        unit = Number(unit);
        if(!Number.isInteger(unit) || unit<0 || unit>8)
            throw new RangeError("SmartPort unit must be an integer from 0 through 8");
        state.unit = unit;
        this.ports.smartport.unit = unit>0 ? unit : null;
        return state.unit;
    };

    this.getUnit = function() { return state.unit; };
    this.getBlockSize = function() { return BLOCK_SIZE; };
    this.getBlockCount = function() { return BLOCK_COUNT; };
    this.getDeviceType = function() { return DEVICE_TYPE; };
    this.getDeviceSubtype = function() { return DEVICE_SUBTYPE; };
    this.getFirmwareVersion = function() { return FW_VERSION; };
    this.getName = function() { return DEVICE_NAME; };

    this.setOnline = function(value)
    {
        state.online = !!value;
        return state.online;
    };

    this.setWriteProtected = function(value)
    {
        state.writeProtected = !!value;
        return state.writeProtected;
    };

    this.loadImage = function(data,metadata)
    {
        var bytes = Uint8Array.from(data || []);
        if(bytes.length!==BLOCK_SIZE*BLOCK_COUNT)
            throw new RangeError("Apple Hard Disk 20 image must be exactly 20971520 bytes");

        media=bytes;
        state.online=true;
        state.mediaFilename = metadata && metadata.filename
            ? String(metadata.filename).split(/[\\/]/).pop()
            : "";
        return media.length;
    };

    this.ejectImage = function()
    {
        media=null;
        state.mediaFilename="";
        return true;
    };

    this.readBlock = function(blockNumber)
    {
        blockNumber=Number(blockNumber);
        if(!state.online || media===null || !Number.isInteger(blockNumber) ||
           blockNumber<0 || blockNumber>=BLOCK_COUNT)
            return {"error":0x27,"data":new Uint8Array(0)};

        var offset=blockNumber*BLOCK_SIZE;
        return {"error":0x00,"data":media.slice(offset,offset+BLOCK_SIZE)};
    };

    this.status = function(statusCode)
    {
        switch(Number(statusCode)&0xFF)
        {
            case 0x00: return {"error":0x00,"data":deviceStatus()};
            case 0x03: return {"error":0x00,"data":deviceInformationBlock()};
            default:   return {"error":0x01,"data":new Uint8Array(0)};
        }
    };

    this.getState = function()
    {
        return {
             "unit":state.unit
            ,"online":state.online
            ,"writeProtected":state.writeProtected
            ,"blockSize":BLOCK_SIZE
            ,"blockCount":BLOCK_COUNT
            ,"deviceType":DEVICE_TYPE
            ,"deviceSubtype":DEVICE_SUBTYPE
            ,"firmwareVersion":FW_VERSION
            ,"name":DEVICE_NAME
            ,"status":statusByte()
            ,"mediaLoaded":media!==null
            ,"mediaBytes":media===null ? 0 : media.length
            ,"mediaFilename":state.mediaFilename
        };
    };
}
