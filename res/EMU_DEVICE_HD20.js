// Emulated Apple Hard Disk 20 logical SmartPort device for RetroAppleJS.
// This is exposed to the Apple II through the Liron SmartPort host.

function HD20Device(options)
{
    options = options || {};

    const BLOCK_SIZE = 512;
    const BLOCK_COUNT = 40960; // 20 MiB
    const DEVICE_TYPE = 0x02;  // SmartPort hard disk
    const DEVICE_SUBTYPE = 0x20; // non-removable hard disk
    const SURFACE_COLUMNS = 40;
    const SURFACE_ROWS = 64;
    const SURFACE_PANELS = 2;
    const SURFACE_BLOCKS_PER_CELL = 8; // 4 KiB per visible 10px cell
    const SURFACE_BYTES_PER_CELL = SURFACE_BLOCKS_PER_CELL*BLOCK_SIZE;
    const SURFACE_CELLS_PER_PANEL = SURFACE_COLUMNS*SURFACE_ROWS; // 2560 cells
    const SURFACE_BLOCKS_PER_PANEL = SURFACE_CELLS_PER_PANEL*SURFACE_BLOCKS_PER_CELL; // 20480 = 10 MiB
    const SURFACE_BLOCKS_PER_PAGE = SURFACE_BLOCKS_PER_PANEL*SURFACE_PANELS; // 40960 = 20 MiB
    const SURFACE_PAGE_COUNT = BLOCK_COUNT/SURFACE_BLOCKS_PER_PAGE; // 1
    const FW_VERSION = options.firmwareVersion===undefined ? 0x0100 : Number(options.firmwareVersion)&0xFFFF;
    const DEVICE_NAME = String(options.name===undefined ? "HARD DISK 20" : options.name).slice(0,16);

    var device=this;
    var state = {
         unit:0
        ,online:options.online===undefined ? true : !!options.online
        ,writeProtected:!!options.writeProtected
        ,mediaFilename:""
        ,dirty:false
        ,lastBlock:null
    };

    var media = new Uint8Array(BLOCK_SIZE * BLOCK_COUNT);
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
        out[24] = (FW_VERSION >> 8)&0xFF;
        return out;
    }

    function volumeName()
    {
        if(media===null || media.length<(3*BLOCK_SIZE)) return "";
        var offset=(2*BLOCK_SIZE)+4;
        var storageAndLength=media[offset]&0xFF;
        if((storageAndLength&0xF0)!==0xF0) return "";
        var length=storageAndLength&0x0F;
        if(length<1 || length>15) return "";
        var name="";
        for(var i=0;i<length;i++)
        {
            var ch=media[offset+1+i]&0x7F;
            if(ch<0x20 || ch>0x7E) return "";
            name+=String.fromCharCode(ch);
        }
        return /^[A-Z][A-Z0-9.]{0,14}$/.test(name) ? name : "";
    }

    function poFilename(name)
    {
        name=String(name || "").split(/[\\/]/).pop();
        if(!name) return "UNFORMATTED-HD20.po";
        name=name.replace(/\.po\.gz$/i,'').replace(/\.[^.]*$/,'');
        return (name || "UNFORMATTED-HD20")+".po";
    }

    function suggestedFilename()
    {
        var volume=volumeName();
        if(volume) return volume+".po";
        if(state.mediaFilename) return poFilename(state.mediaFilename);
        return "UNFORMATTED-HD20.po";
    }

    function notifyFilenameChange(previous)
    {
        if(previous===suggestedFilename()) return;
        if(host && typeof(host.deviceMediaMetadataChanged)==="function") host.deviceMediaMetadataChanged(device);
    }

    function surfaceDensityPalette()
    {
        var anchors=["#2D788E","#2CA984","#7DD552","#FDEA27"];
        var palette=Array(101);
        function rgb(hex)
        {
            hex=String(hex).replace("#","");
            return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
        }
        function hex(value)
        {
            return Math.max(0,Math.min(255,Math.round(value))).toString(16).toUpperCase().padStart(2,"0");
        }
        for(var i=0;i<100;i++)
        {
            var range=100/(anchors.length-1);
            var index=Math.floor(i/range);
            if(index>=anchors.length-1) index=anchors.length-2;
            var pct=Math.round(Math.floor(i%range)*100/range);
            var a=rgb(anchors[index]), b=rgb(anchors[index+1]);
            palette[i]="#"+
                hex(a[0]+(b[0]-a[0])*pct/100)+
                hex(a[1]+(b[1]-a[1])*pct/100)+
                hex(a[2]+(b[2]-a[2])*pct/100);
        }
        palette[0]="#000000";
        palette[100]=anchors[anchors.length-1];
        return palette;
    }

    var SURFACE_DENSITY_PALETTE=surfaceDensityPalette();

    function surfaceRangeDensity(startBlock,endBlock)
    {
        startBlock=Number(startBlock); endBlock=Number(endBlock);
        var start=startBlock*BLOCK_SIZE;
        var end=(endBlock+1)*BLOCK_SIZE;
        var bytes=end-start;
        var nonzero=0, sum=0;
        if(!media || start<0 || end>media.length || bytes<=0) return {"pct":0,"nonzero":0,"avg":0};
        for(var i=start;i<end;i++)
        {
            var value=media[i]&0xFF;
            sum+=value;
            if(value!==0) nonzero++;
        }
        return {
             "pct":Math.round(nonzero*100/bytes)
            ,"nonzero":nonzero
            ,"avg":Math.round(sum/bytes)
        };
    }

    function surfaceEscape(value)
    {
        return String(value==null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/"/g,"&quot;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    function surfaceHeader(owner,syncEnabled)
    {
        var slotN=owner && owner.mount ? Number(owner.mount.slotN) : NaN;
        var iconClass=syncEnabled ? "fa-stop-circle" : "fa-sync-alt";
        var syncOnClick=Number.isInteger(slotN)
            ? "apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggleSync();event.stopPropagation();"
            : "event.stopPropagation();";
        return "<div class=\"liron-surface-header\" style=\"display:flex;align-items:center;gap:6px;margin:0 0 4px 0\">"+
            "<button class=\"appbut\" type=\"button\" style=\"text-align:center\" title=\"Disk surface map sync\" onclick=\""+syncOnClick+"\">"+
            "<i class=\"fa "+iconClass+"\" id=\"lironSurfaceMap_monitoring\"></i></button>"+
            "<div class=\"liron-surface-title\"><b>Disk surface map</b></div>"+
            "</div>";
    }

    this.renderSurfaceMapHTML = function(header)
    {
        var instance=Number(this.attach?.hash);
        instance=Number.isInteger(instance) ? (instance&0xFFFF).toString(16).toUpperCase().padStart(4,"0") : "????";
        var hash=Number(this.attach?.hash);
        var unit=Number(this.getUnit());
        var head=this.getHeadSurfacePosition();
        var css="<style>.liron-surface-hd20 .liron-surface-cell{display:block;width:10px;height:10px;box-sizing:border-box;border:1px solid #333}.liron-surface-hd20 .liron-surface-track{box-sizing:border-box}</style>";
        var out=header+css+"<div class=\"liron-surface-hd20-root\" data-hd20-surface-map=\"1\" data-unit=\""+unit+"\" data-hash=\""+hash+"\">"+
            "<div class=\"liron-surface-panels liron-surface-hd20\" style=\"display:inline-flex;align-items:flex-start;gap:8px;width:max-content\">";
        for(var panel=0;panel<SURFACE_PANELS;panel++)
        {
            var startMiB=panel*10;
            out += "<section class=\"liron-surface-side liron-surface-hd20-panel\" data-panel=\""+panel+"\" style=\"flex:0 0 auto;margin:0\">"+
                "<div class=\"liron-surface-side-title\" style=\"text-align:center;font-size:11px;line-height:12px;padding:0 0 2px 36px\">"+startMiB+"–"+(startMiB+10)+" MiB</div>"+
                "<div class=\"liron-surface-grid\" style=\"display:grid;grid-template-columns:36px repeat(40,10px);grid-template-rows:repeat(64,10px);gap:0;overflow:hidden\">";
            for(var row=0;row<SURFACE_ROWS;row++)
            {
                var rowMiB=startMiB+(row*10/SURFACE_ROWS);
                var rowLabel=row%16===0 ? ((Math.round(rowMiB*10)/10)+"M") : "";
                out += "<span class=\"liron-surface-track\" data-row-label=\""+row+"\" style=\"display:flex;align-items:center;justify-content:flex-end;height:10px;padding-right:4px;color:#aaa;font-family:Courier;font-size:8px;line-height:10px;overflow:visible\">"+rowLabel+"</span>";
                for(var column=0;column<SURFACE_COLUMNS;column++)
                {
                    var blockRange=this.surfaceCellToBlockRange(0,panel,row,column);
                    var density=surfaceRangeDensity(blockRange.startBlock,blockRange.endBlock);
                    var isHead=!!(head && head.block>=blockRange.startBlock && head.block<=blockRange.endBlock);
                    var bandStart=row>0 && row%16===0;
                    var style="background:"+SURFACE_DENSITY_PALETTE[density.pct]+";"+
                        (bandStart?"border-top-width:2px;":"")+
                        (isHead?"outline:2px solid #FFF;outline-offset:-1px;":"");
                    var tip="Blocks "+blockRange.startBlock+"–"+blockRange.endBlock+" · 4 KiB · offset "+blockRange.offset+"–"+(blockRange.offset+blockRange.bytes-1)+
                        " · nonzero="+density.nonzero+"/"+blockRange.bytes+" · avg="+density.avg+(isHead?" · Head block "+head.block:"");
                    out += "<span class=\"liron-surface-cell active"+(isHead?" liron-surface-head":"")+"\" style=\""+style+
                        "\" data-surface-cell=\"1\" data-active=\"1\" data-density=\""+density.pct+"\" data-page=\"0\" data-panel=\""+panel+"\" data-row=\""+row+"\" data-column=\""+column+
                        "\" data-block=\""+blockRange.startBlock+"\" data-start-block=\""+blockRange.startBlock+"\" data-end-block=\""+blockRange.endBlock+"\" data-offset=\""+blockRange.offset+"\" data-head=\""+(isHead?"1":"0")+"\" title=\""+surfaceEscape(tip)+"\"></span>";
                }
            }
            out += "</div></section>";
        }
        return out+"</div><div class=\"liron-surface-meta\" style=\"font-size:10px;color:#888;margin-top:4px;line-height:12px\">"+
            "Instance #"+instance+" · 20 MiB · 40960 × 512-byte blocks · "+(SURFACE_PANELS*SURFACE_CELLS_PER_PANEL)+" × 4 KiB cells</div></div>";
    };

    function installHostSurfaceMapView(owner)
    {
        if(!owner || owner.__hd20FullSurfaceViewInstalled) return;
        if(typeof(owner.deviceToolSurfaceMapHTML)!=="function") return;
        var baseHTML=owner.deviceToolSurfaceMapHTML;
        var baseToggleSync=typeof(owner.deviceToolSurfaceMapToggleSync)==="function" ? owner.deviceToolSurfaceMapToggleSync : null;
        var basePosition=typeof(owner.deviceToolSurfaceMapPosition)==="function" ? owner.deviceToolSurfaceMapPosition : null;
        var baseRefresh=typeof(owner.deviceToolSurfaceMapRefresh)==="function" ? owner.deviceToolSurfaceMapRefresh : null;
        var baseMonitoring=typeof(owner.deviceToolSurfaceMapMonitoring)==="function" ? owner.deviceToolSurfaceMapMonitoring : null;
        var syncEnabled=false;

        owner.deviceToolSurfaceMapHTML=function(unit,expectedHash)
        {
            var target=typeof(owner.getHD20)==="function" ? owner.getHD20(unit) : null;
            if(target && Number(target.attach?.hash)===Number(expectedHash) && typeof(target.renderSurfaceMapHTML)==="function") return target.renderSurfaceMapHTML(surfaceHeader(owner,syncEnabled));
            return baseHTML.call(owner,unit,expectedHash);
        };

        function refreshHD20Surface()
        {
            if(typeof(document)==="undefined" || !document.getElementById) return false;
            var text=document.getElementById("lironSurfaceMap_popup_text");
            if(!text || typeof text.querySelector !== "function") return false;
            var root=text.querySelector('[data-hd20-surface-map="1"]');
            if(!root) return false;
            var unit=Number(root.dataset ? root.dataset.unit : root.getAttribute("data-unit"));
            var hash=Number(root.dataset ? root.dataset.hash : root.getAttribute("data-hash"));
            if(!Number.isInteger(unit) || !Number.isInteger(hash)) return false;
            text.innerHTML=owner.deviceToolSurfaceMapHTML(unit,hash);
            return true;
        }

        if(baseToggleSync)
        {
            owner.deviceToolSurfaceMapToggleSync=function(force)
            {
                var result=baseToggleSync.call(owner,force);
                syncEnabled=!!result;
                return result;
            };
        }
        if(baseRefresh)
        {
            owner.deviceToolSurfaceMapRefresh=function()
            {
                if(refreshHD20Surface()) return true;
                return baseRefresh.call(owner);
            };
        }
        if(baseMonitoring)
        {
            owner.deviceToolSurfaceMapMonitoring=function()
            {
                if(refreshHD20Surface()) return true;
                return baseMonitoring.call(owner);
            };
        }
        if(basePosition)
        {
            owner.deviceToolSurfaceMapPosition=function(unit)
            {
                var result=basePosition.call(owner,unit);
                var target=typeof(owner.getHD20)==="function" ? owner.getHD20(unit) : null;
                if(target && typeof(document)!=="undefined" && document.getElementById && typeof(window)!==="undefined")
                {
                    var popup=document.getElementById("lironSurfaceMap_popup");
                    if(popup)
                    {
                        var scrollX=Number(window.scrollX)||0;
                        var viewportLeft=(parseFloat(popup.style.left)||8)-scrollX;
                        var available=Math.max(120,Math.floor(window.innerWidth-viewportLeft-8));
                        popup.style.width=Math.min(1056,available)+"px";
                        popup.style.maxWidth=available+"px";
                    }
                }
                return result;
            };
        }
        owner.__hd20FullSurfaceViewInstalled=true;
    }

    this.bindHost = function(owner)
    {
        if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachSmartPortDevice)!=="function") return false;
        if(host && host!==owner) return false;
        if(owner.attachSmartPortDevice(this)!==this) return false;
        host=owner;
        installHostSurfaceMapView(owner);
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
        if(!Number.isInteger(unit) || unit<0 || unit>8) throw new RangeError("SmartPort unit must be an integer from 0 through 8");
        state.unit = unit;
        this.ports.smartport.unit = unit>0 ? unit : null;
        return state.unit;
    };

    this.getUnit = function() { return state.unit; };
    this.getBlockSize = function() { return BLOCK_SIZE; };
    this.getBlockCount = function() { return BLOCK_COUNT; };
    this.getLastBlock = function() { return state.lastBlock; };
    this.getHeadSurfacePosition = function()
    {
        return Number.isInteger(state.lastBlock) ? this.blockToSurfaceCell(state.lastBlock) : null;
    };
    this.getSurfaceMapGeometry = function()
    {
        return {
             "kind":"logical-block-surface"
            ,"panels":SURFACE_PANELS
            ,"columnsPerPanel":SURFACE_COLUMNS
            ,"rowsPerPanel":SURFACE_ROWS
            ,"cellsPerPanel":SURFACE_CELLS_PER_PANEL
            ,"blocksPerCell":SURFACE_BLOCKS_PER_CELL
            ,"bytesPerCell":SURFACE_BYTES_PER_CELL
            ,"blocksPerPanel":SURFACE_BLOCKS_PER_PANEL
            ,"blocksPerPage":SURFACE_BLOCKS_PER_PAGE
            ,"pageCount":SURFACE_PAGE_COUNT
            ,"bytesPerBlock":BLOCK_SIZE
            ,"totalBlocks":BLOCK_COUNT
            ,"totalBytes":BLOCK_COUNT*BLOCK_SIZE
        };
    };
    this.surfaceCellToBlock = function(page,panel,row,column)
    {
        page=Number(page); panel=Number(panel); row=Number(row); column=Number(column);
        if(!Number.isInteger(page) || page<0 || page>=SURFACE_PAGE_COUNT || !Number.isInteger(panel) || panel<0 || panel>=SURFACE_PANELS || !Number.isInteger(row) || row<0 || row>=SURFACE_ROWS || !Number.isInteger(column) || column<0 || column>=SURFACE_COLUMNS) return null;
        var cell=panel*SURFACE_CELLS_PER_PANEL + row*SURFACE_COLUMNS + column;
        return page*SURFACE_BLOCKS_PER_PAGE + cell*SURFACE_BLOCKS_PER_CELL;
    };
    this.surfaceCellToBlockRange = function(page,panel,row,column)
    {
        var startBlock=this.surfaceCellToBlock(page,panel,row,column);
        if(startBlock===null) return null;
        var endBlock=Math.min(BLOCK_COUNT-1,startBlock+SURFACE_BLOCKS_PER_CELL-1);
        return {"startBlock":startBlock,"endBlock":endBlock,"offset":startBlock*BLOCK_SIZE,"bytes":(endBlock-startBlock+1)*BLOCK_SIZE};
    };
    this.blockToSurfaceCell = function(block)
    {
        block=Number(block);
        if(!Number.isInteger(block) || block<0 || block>=BLOCK_COUNT) return null;
        var page=Math.floor(block/SURFACE_BLOCKS_PER_PAGE);
        var inPage=block-page*SURFACE_BLOCKS_PER_PAGE;
        var panel=Math.floor(inPage/SURFACE_BLOCKS_PER_PANEL);
        var inPanel=inPage-panel*SURFACE_BLOCKS_PER_PANEL;
        var cell=Math.floor(inPanel/SURFACE_BLOCKS_PER_CELL);
        var row=Math.floor(cell/SURFACE_COLUMNS);
        var column=cell%SURFACE_COLUMNS;
        return {"page":page,"panel":panel,"row":row,"column":column,"block":block,"offset":block*BLOCK_SIZE,"bytes":BLOCK_SIZE};
    };
    this.getDeviceType = function() { return DEVICE_TYPE; };
    this.getDeviceSubtype = function() { return DEVICE_SUBTYPE; };
    this.getFirmwareVersion = function() { return FW_VERSION; };
    this.getName = function() { return DEVICE_NAME; };
    this.getImage = function() { return media===null ? new Uint8Array(BLOCK_SIZE*BLOCK_COUNT) : media.slice(); };
    this.getVolumeName = function() { return volumeName(); };
    this.getSuggestedFilename = function() { return suggestedFilename(); };

    this.setOnline = function(value) { state.online = !!value; return state.online; };
    this.setWriteProtected = function(value) { state.writeProtected = !!value; return state.writeProtected; };

    this.loadImage = function(data,metadata)
    {
        var previous=suggestedFilename();
        var bytes = Uint8Array.from(data || []);
        if(bytes.length!==BLOCK_SIZE*BLOCK_COUNT) throw new RangeError("Apple Hard Disk 20 image must be exactly 20971520 bytes");
        media=bytes;
        state.online=true;
        state.dirty=false;
        state.lastBlock=null;
        state.mediaFilename = metadata && metadata.filename ? String(metadata.filename).split(/[\\/]/).pop() : "";
        notifyFilenameChange(previous);
        return media.length;
    };

    this.ejectImage = function()
    {
        var previous=suggestedFilename();
        if(media===null || media.length!==BLOCK_SIZE*BLOCK_COUNT) media=new Uint8Array(BLOCK_SIZE*BLOCK_COUNT);
        else media.fill(0);
        state.online=true;
        state.mediaFilename="";
        state.dirty=false;
        state.lastBlock=null;
        notifyFilenameChange(previous);
        return true;
    };

    this.readBlock = function(blockNumber)
    {
        blockNumber=Number(blockNumber);
        if(!state.online || media===null || !Number.isInteger(blockNumber) || blockNumber<0 || blockNumber>=BLOCK_COUNT) return {"error":0x27,"data":new Uint8Array(0)};
        var offset=blockNumber*BLOCK_SIZE;
        state.lastBlock=blockNumber;
        return {"error":0x00,"data":media.slice(offset,offset+BLOCK_SIZE)};
    };

    this.writeBlock = function(blockNumber,data)
    {
        blockNumber=Number(blockNumber);
        if(!state.online || media===null) return {"error":0x2F};
        if(state.writeProtected) return {"error":0x2B};
        if(!Number.isInteger(blockNumber) || blockNumber<0 || blockNumber>=BLOCK_COUNT) return {"error":0x2D};
        if(!data || typeof(data.length)!=="number" || data.length!==BLOCK_SIZE) return {"error":0x27};
        var previous=blockNumber===2 ? suggestedFilename() : null;
        media.set(data,blockNumber*BLOCK_SIZE);
        state.dirty=true;
        state.lastBlock=blockNumber;
        if(previous!==null) notifyFilenameChange(previous);
        return {"error":0x00};
    };

    this.format = function()
    {
        if(!state.online || media===null) return {"error":0x2F};
        if(state.writeProtected) return {"error":0x2B};
        var previous=suggestedFilename();
        media.fill(0);
        state.dirty=true;
        state.lastBlock=null;
        notifyFilenameChange(previous);
        return {"error":0x00};
    };

    this.status = function(statusCode)
    {
        switch(Number(statusCode)&0xFF)
        {
            case 0x00: return {"error":0x00,"data":deviceStatus()};
            case 0x03: return {"error":0x00,"data":deviceInformationBlock()};
            default: return {"error":0x01,"data":new Uint8Array(0)};
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
            ,"logicalFilename":suggestedFilename()
            ,"volumeName":volumeName()
            ,"dirty":state.dirty
            ,"lastBlock":state.lastBlock
        };
    };
}