from pathlib import Path

# Update and extend tests.
t=Path('tests/liron_toolbox.test.js')
ts=t.read_text().replace("['Unit1','Unit2']","['UNIDISK Unit1','UNIDISK Unit2']")
ts += r'''

test('UniDisk row identifies device and instance and exposes its surface-map capability', () => {
    const rows=[];
    const context=loadLiron({EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row></row>';}});
    const card=new context.AppleLiron(); card.mount={slotN:6};
    const disk=new context.UniDisk35Device(); disk.setUnit(1); disk.attach={hash:0x9B05}; card.devices=[disk];
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].label,'UNIDISK Unit1');
    assert.equal(rows[0].buttonTitle,'Instance #9B05: eject disk');
    assert.equal(rows[0].capabilityActions.length,1);
    assert.equal(rows[0].capabilityActions[0].id,'liron_unit_5_1_surface');
    assert.equal(rows[0].capabilityActions[0].title,'Disk Surface Map (no media loaded)');
    assert.equal(rows[0].capabilityActions[0].disabled,true);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'}); rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].capabilityActions[0].disabled,false);
    assert.match(rows[0].capabilityActions[0].onClick,/deviceToolSurfaceMap\(1,39685\)/);
});

test('Liron synchronizes Download and Surface Map in place without clearing a successful file selection', () => {
    function el(value='') { return {disabled:true,title:'',value,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];}}; }
    const nodes={liron_unit_5_1_dump:el(),liron_unit_5_1_surface:el(),liron_unit_5_1_but:el(),liron_unit_5_1_file:el('C:\\fakepath\\TOOLS.po')};
    const context=loadLiron({document:{getElementById(id){return nodes[id]||null;}},apple2plus:{hwObj(){return {io:{slot2ID(){return '5';}}};}}});
    const card=new context.AppleLiron(); card.mount={slotN:6};
    const disk=new context.UniDisk35Device(); disk.setUnit(1); disk.attach={hash:0x9B05}; card.devices=[disk];
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});
    assert.equal(card.deviceToolSyncMediaControls(1),true);
    assert.equal(nodes.liron_unit_5_1_dump.disabled,false);
    assert.equal(nodes.liron_unit_5_1_dump.title,'Save TOOLS.po');
    assert.match(nodes.liron_unit_5_1_dump.attrs.onclick,/deviceToolDownload\(1\)/);
    assert.equal(nodes.liron_unit_5_1_surface.disabled,false);
    assert.match(nodes.liron_unit_5_1_surface.attrs.onclick,/deviceToolSurfaceMap\(1,39685\)/);
    assert.equal(nodes.liron_unit_5_1_but.title,'Instance #9B05: eject disk');
    assert.equal(nodes.liron_unit_5_1_file.value,'C:\\fakepath\\TOOLS.po');
    disk.ejectImage();
    assert.equal(card.deviceToolSyncMediaControls(1,{clearFile:true}),true);
    assert.equal(nodes.liron_unit_5_1_dump.disabled,true);
    assert.equal(nodes.liron_unit_5_1_surface.disabled,true);
    assert.equal(nodes.liron_unit_5_1_file.value,'');
    assert.equal('onclick' in nodes.liron_unit_5_1_dump.attrs,false);
    assert.equal('onclick' in nodes.liron_unit_5_1_surface.attrs,false);
});
'''
t.write_text(ts)

p=Path('res/EMU_CARD_LIRON.js')
s=p.read_text()
marker='    this.deviceToolSlotHTML = function(ctx)\n    {'
helper='''    function deviceToolUnitDevice(unit)
    {
        unit=Number(unit);
        var device=smartport.getDevice(unit);
        if(device) return device;
        var attached=Array.isArray(liron.devices) ? liron.devices : [];
        for(var i=0;i<attached.length;i++)
        {
            var n=typeof(attached[i]?.getUnit)==="function" ? Number(attached[i].getUnit()) : Number(attached[i]?.id?.deviceN);
            if(n===unit) return attached[i];
        }
        return null;
    }

    function deviceToolInstanceHex(device)
    {
        var hash=Number(device && device.attach ? device.attach.hash : NaN);
        if(!Number.isInteger(hash)) return null;
        return (hash&0xFFFF).toString(16).toUpperCase().padStart(4,"0");
    }

    this.deviceToolSyncMediaControls = function(unit,options)
    {
        options=options || {}; unit=Number(unit);
        var device=deviceToolUnitDevice(unit); if(!device) return false;
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN; if(!Number.isInteger(slotN)) return false;
        var io=typeof(apple2plus)==="object" && apple2plus ? apple2plus.hwObj().io : null;
        var slotID=io && typeof(io.slot2ID)==="function" ? String(io.slot2ID(slotN)) : String(slotN-1);
        var controlID="liron_unit_"+slotID+"_"+unit;
        var deviceCode=String(device.id?.DCODE || "SMARTPORT"), hardDisk=deviceCode==="HD20";
        var state=typeof(device.getState)==="function" ? device.getState() || {} : {};
        var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
        var downloadable=exportable && (hardDisk || !!state.mediaLoaded);
        var filename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : "";
        var instance=deviceToolInstanceHex(device);
        if(typeof(document)==="undefined" || !document.getElementById) return false;
        function setClick(el,handler) { if(!el) return; if(handler) el.setAttribute("onclick",handler); else el.removeAttribute("onclick"); }
        var download=document.getElementById(controlID+"_dump");
        if(download)
        {
            download.disabled=!downloadable;
            download.title=downloadable ? ("Save "+filename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)");
            setClick(download,downloadable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : null);
        }
        var surface=document.getElementById(controlID+"_surface");
        if(surface)
        {
            var canMap=deviceCode==="UNIDISK" && typeof(device.getSurfaceMapGeometry)==="function" && !!state.mediaLoaded;
            surface.disabled=!canMap; surface.title=canMap ? "Disk Surface Map" : "Disk Surface Map (no media loaded)";
            setClick(surface,canMap ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMap("+unit+","+Number(device.attach?.hash)+")") : null);
        }
        var eject=document.getElementById(controlID+"_but");
        if(eject) eject.title=(instance ? ("Instance #"+instance+": ") : ("Unit"+unit+": "))+(hardDisk ? "erase/reset disk" : "eject disk");
        if(options.clearFile) { var file=document.getElementById(controlID+"_file"); if(file) try { file.value=""; } catch(e) {} }
        return true;
    };

    this.deviceToolSlotHTML = function(ctx)
    {'''
if marker not in s: raise SystemExit('slot HTML marker missing')
s=s.replace(marker,helper,1)
old='''            var downloadable=exportable && (hardDisk || !!deviceState.mediaLoaded);
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : undefined;

            rows += EMU_deviceMediaRowHTML({
                 "label":"Unit"+unit'''
new='''            var downloadable=exportable && (hardDisk || !!deviceState.mediaLoaded);
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : undefined;
            var isUniDisk=deviceCode==="UNIDISK" && typeof(device.getSurfaceMapGeometry)==="function";
            var instanceHash=Number(device.attach?.hash);
            var instanceHex=deviceToolInstanceHex(device);

            rows += EMU_deviceMediaRowHTML({
                 "label":deviceCode+" Unit"+unit'''
if old not in s: raise SystemExit('row identity marker missing')
s=s.replace(old,new,1)
old=',"buttonTitle":hardDisk ? ("Unit"+unit+": erase/reset disk") : ("Unit"+unit+": eject disk")'
new=',"buttonTitle":(instanceHex ? ("Instance #"+instanceHex+": ") : ("Unit"+unit+": "))+(hardDisk ? "erase/reset disk" : "eject disk")'
if old not in s: raise SystemExit('button title marker missing')
s=s.replace(old,new,1)
old=''',"downloadTitle":downloadable ? ("Save "+logicalFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")
            });'''
new=''',"downloadTitle":downloadable ? ("Save "+logicalFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")
                ,"capabilityActions":isUniDisk ? [{"id":controlID+"_surface","icon":"fa fa-th","title":deviceState.mediaLoaded ? "Disk Surface Map" : "Disk Surface Map (no media loaded)","onClick":deviceState.mediaLoaded ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMap("+unit+","+instanceHash+")") : undefined,"disabled":!deviceState.mediaLoaded}] : []
            });'''
if old not in s: raise SystemExit('row action marker missing')
s=s.replace(old,new,1)
load_start=s.index('    this.deviceToolLoadFile = function')
load_pos=s.index('                if(typeof(apple2plus)',load_start)
s=s[:load_pos]+'                liron.deviceToolSyncMediaControls(unit);\n\n'+s[load_pos:]
eject_start=s.index('    this.deviceToolEject = function')
eject_line='        if(target.ejectImage()===false) return false;'
eject_pos=s.index(eject_line,eject_start)+len(eject_line)
s=s[:eject_pos]+'\n        liron.deviceToolSyncMediaControls(unit,{"clearFile":true});'+s[eject_pos:]
p.write_text(s)
