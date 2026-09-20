from pathlib import Path

# Optional deviceConfig entries remain picker-visible but are not provisioned on restart.
io_path=Path('res/EMU_apple2io.js')
s=io_path.read_text()
old='''        var deviceConfig = Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        for(var deviceN=0;deviceN<deviceConfig.length;deviceN++)
            this.attach(owner,deviceConfig[deviceN]);
'''
new='''        var deviceConfig = Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        for(var deviceN=0;deviceN<deviceConfig.length;deviceN++)
        {
            var deviceInfo=deviceConfig[deviceN];
            if(deviceInfo && deviceInfo.autoAttach!==false)
                this.attach(owner,deviceInfo);
        }
'''
if old not in s:
    raise SystemExit('provisionPeripheral block not found')
s=s.replace(old,new,1)
io_path.write_text(s)

# Register HD20 as an optional Liron child and add generic SmartPort host hooks.
liron_path=Path('res/EMU_CARD_LIRON.js')
s=liron_path.read_text()
start=s.index('    this.deviceConfig = [{')
end=s.index('    }];',start)
replacement='''    },{
         "DCODE":"HD20"
        ,"hostPCODE":"LIRON"
        ,"coID":"HD20Device"
        ,"icon":"fa fa-hdd"
        ,"description":"Apple Hard Disk 20"
        ,"autoAttach":false
    }];'''
s=s[:end]+replacement+s[end+len('    }];'):]

marker='''    this.attachUniDisk = function(device)
'''
if marker not in s:
    raise SystemExit('attachUniDisk marker not found')
generic='''    this.attachSmartPortDevice = function(device)
    {
        if(!device || device.id?.hostPCODE!=="LIRON") return null;

        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit>=1 && unit<=8 && smartport.getDevice(unit)===device) return device;

        smartport.attach(device);
        unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(device.id && unit>=1 && unit<=8) device.id.deviceN=unit;
        return device;
    };

    this.detachSmartPortDevice = function(device)
    {
        if(!device) return false;
        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit<1 || unit>8 || smartport.getDevice(unit)!==device) return false;
        smartport.detach(device);
        return true;
    };

'''
s=s.replace(marker,generic+marker,1)

# Add a typed HD20 accessor after getUniDisk(), preserving the legacy accessor untouched.
fn='    this.getUniDisk = function(unit)'
start=s.index(fn)
brace=s.index('{',start)
depth=0
quote=''
escape=False
end=None
for i in range(brace,len(s)):
    ch=s[i]
    if quote:
        if escape:
            escape=False
        elif ch=='\\\\':
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
            semi=s.find(';',i)
            end=semi+1
            break
if end is None:
    raise SystemExit('getUniDisk function end not found')
getter='''

    this.getHD20 = function(unit)
    {
        if(unit!==undefined && unit!==null && unit!=="")
        {
            unit=Number(unit);
            if(!Number.isInteger(unit) || unit<1 || unit>8) return null;
            var device=smartport.getDevice(unit);
            return device?.id?.DCODE==="HD20" ? device : null;
        }

        var units=smartport.getUnits();
        for(var i=0;i<units.length;i++)
        {
            var device=smartport.getDevice(units[i]);
            if(device?.id?.DCODE==="HD20") return device;
        }
        return null;
    };'''
s=s[:end]+getter+s[end:]
liron_path.write_text(s)

# Load the HD20 constructor before the Liron card in the browser.
index_path=Path('index.html')
s=index_path.read_text()
needle='''            <script type="text/javascript" src="res/EMU_DEVICE_UNIDISK35.js"></script>'''
insert=needle+'''\n            <script type="text/javascript" src="res/EMU_DEVICE_HD20.js"></script>'''
if needle not in s:
    raise SystemExit('UniDisk script tag not found')
s=s.replace(needle,insert,1)
index_path.write_text(s)
