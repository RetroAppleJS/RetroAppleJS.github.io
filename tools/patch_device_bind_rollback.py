from pathlib import Path

p=Path('res/EMU_apple2io.js')
s=p.read_text()

old='''        var entry=null;
        var key="";
        var device=null;'''
new='''        var entry=null;
        var key="";
        var device=null;
        var createdInstance=false;'''
if old not in s: raise SystemExit('attach local block not found')
s=s.replace(old,new,1)

old='''            device=new Device(device_info);
            if(!device.id) device.id={};'''
new='''            device=new Device(device_info);
            createdInstance=true;
            if(!device.id) device.id={};'''
if old not in s: raise SystemExit('device construction block not found')
s=s.replace(old,new,1)

old='''        if(typeof(device.bindHost)=="function")
        {
            var hostResult=device.bindHost(owner);
            if(hostResult===false)
            {
                delete this.attachments[key];
                var failedIdx=owner.devices.indexOf(device);
                if(failedIdx>=0) owner.devices.splice(failedIdx,1);
                return null;
            }
        }'''
new='''        if(typeof(device.bindHost)=="function")
        {
            var rollbackHostBind=function()
            {
                if(!createdInstance) return;
                delete io.attachments[key];
                var failedIdx=owner.devices.indexOf(device);
                if(failedIdx>=0) owner.devices.splice(failedIdx,1);
            };
            var hostResult;
            try
            {
                hostResult=device.bindHost(owner);
            }
            catch(e)
            {
                rollbackHostBind();
                throw e;
            }
            if(hostResult===false)
            {
                rollbackHostBind();
                return null;
            }
        }'''
if old not in s: raise SystemExit('bindHost block not found')
s=s.replace(old,new,1)

p.write_text(s)
