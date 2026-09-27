from pathlib import Path


def must_replace(src, old, new):
    if old not in src:
        raise SystemExit('Missing expected block:\n' + old[:600])
    return src.replace(old, new, 1)


path = Path('res/EMU_CARD_appledisk2.js')
text = path.read_text()

text = must_replace(text,
'''        ,"drv":0
        ,"DSK_led" :[]
        ,"DSK_lid":[]
        ,"diskData":[null,null]
''',
'''        ,"drv":0
        ,"diskData":[null,null]
''')

text = text.replace('            ,"LED":false\n', '')

text = must_replace(text,
'''    function mountedIO()
    {
        if(typeof(apple2plus)!="object" || !apple2plus) return null;
        return apple2plus.hwObj().io;
    }

    this.getDiskCatalogContext = function()
''',
'''    function mountedIO()
    {
        if(typeof(apple2plus)!="object" || !apple2plus) return null;
        return apple2plus.hwObj().io;
    }

    function diskLayout()
    {
        if(typeof(oCOM)!="object" || !oCOM || !oCOM.LAYOUT) return null;
        if(!oCOM.LAYOUT.A2P || !oCOM.LAYOUT.A2P.DISKII) return null;
        return oCOM.LAYOUT.A2P.DISKII;
    }

    function driveLayout(deviceN)
    {
        if(typeof deviceN == "string")
        {
            var m = deviceN.toUpperCase().match(/^D([12])$/);
            deviceN = m ? Number(m[1])-1 : NaN;
        }

        deviceN = Number(deviceN);
        if(!Number.isInteger(deviceN) || deviceN<0 || deviceN>1) return null;

        var layout = diskLayout();
        return layout ? layout["D"+(deviceN+1)] || null : null;
    }

    this.setDriveLED = function(deviceN,on)
    {
        var drive = driveLayout(deviceN);
        if(drive && typeof drive.LED == "function") drive.LED(!!on);
    }

    this.setDriveLidClosed = function(deviceN,closed)
    {
        var drive = driveLayout(deviceN);
        if(drive && typeof drive.LID == "function") drive.LID(!!closed);
    }

    this.syncDriveVisuals = function()
    {
        for(var i=0;i<state.hw.length;i++)
        {
            this.setDriveLED(i,state.hw[i] && state.hw[i].motor);
            this.setDriveLidClosed(i,state.diskData[i]!=null);
        }
    };

    this.getDiskCatalogContext = function()
''')

text = must_replace(text,
'''            state.hw[i].motor = newMotor;
            if (oldMotor != newMotor)
''',
'''            state.hw[i].motor = newMotor;
            this.setDriveLED(i,newMotor);
            if (oldMotor != newMotor)
''')

text = must_replace(text,
'''        this.traceSoftSwitchMarker("RESET");
    }

    this.getState = function() { return state }

    this.GUI_update = function() {}   // overridable function to update drive status (LED)
''',
'''        this.traceSoftSwitchMarker("RESET");
        this.syncDriveVisuals();
    }

    this.getState = function() { return state }

    this.GUI_update = function() { this.syncDriveVisuals(); }   // update drive status (LED/lid)
''')

text = must_replace(text,
'''                if(!apple2plus.loadDisk(nibBytes,deviceID,slotN))
                    throw new Error(
                        "DISKII is not mounted in slotN="
                        + slotN
                    );

                var fileName = arg.name || (arg.path || "").split("/").pop() || "disk image";
''',
'''                if(!apple2plus.loadDisk(nibBytes,deviceID,slotN))
                    throw new Error(
                        "DISKII is not mounted in slotN="
                        + slotN
                    );

                var deviceN = deviceRef.deviceN;
                disk2.setDriveLidClosed(deviceN,true);

                var fileName = arg.name || (arg.path || "").split("/").pop() || "disk image";
''')

text = must_replace(text,
'''            if(typeof drv == "number") drv = "D" + drv;

            var el = this.diskMiddleEl(drv);
''',
'''            if(typeof drv == "number") drv = "D" + drv;
            this.setDriveLidClosed(drv,false);

            var el = this.diskMiddleEl(drv);
''')

text = must_replace(text,
'''    this.driveElementID = function(prefix,drv)
    {
        if(typeof drv == "number") drv = "D" + drv;
        var slotN = ssSlotNumber();
    }

''','')

path.write_text(text)

plus = Path('res/EMU_apple2plus.js')
ptext = plus.read_text()
ptext = must_replace(ptext,
'''        disk2.getState().diskData[device.deviceN] = bytes;
        return true;
''',
'''        disk2.getState().diskData[device.deviceN] = bytes;
        if(typeof disk2.setDriveLidClosed == "function")
            disk2.setDriveLidClosed(device.deviceN,true);
        return true;
''')
plus.write_text(ptext)

test_path = Path('tests/appledisk2_layout_visuals.test.js')
ttext = test_path.read_text()
ttext = must_replace(ttext,
'''  assert.match(diskIISource,/this\\.setDriveLidClosed\\(deviceN,true\\)/);
''',
'''  assert.match(diskIISource,/setDriveLidClosed\\(deviceN,true\\)/);
''')
test_path.write_text(ttext)
