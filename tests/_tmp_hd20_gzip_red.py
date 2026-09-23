from pathlib import Path

test=Path('tests/hd20_toolbox_media.test.js')
s=test.read_text()

needle="const hd20Source=fs.readFileSync('res/EMU_DEVICE_HD20.js','utf8');\n"
if "const pakoSource=" not in s:
    if needle not in s: raise SystemExit('hd20Source declaration not found')
    s=s.replace(needle, needle+"const pakoSource=fs.readFileSync('res/pako.min.js','utf8');\n",1)

needle="    vm.runInContext(hd20Source,context,{filename:'EMU_DEVICE_HD20.js'});\n"
if "vm.runInContext(pakoSource" not in s:
    if needle not in s: raise SystemExit('loadLiron HD20 vm line not found')
    s=s.replace(needle, "    vm.runInContext(pakoSource,context,{filename:'pako.min.js'});\n"+needle,1)

old="""    assert.match(rows[0].fileOnChange,/deviceToolLoadFile\\(this,1\\)/);
    assert.match(rows[1].fileOnChange,/deviceToolLoadFile\\(this,2\\)/);"""
new=old+"""
    assert.equal(rows[0].fileAccept,'.po');
    assert.equal(rows[1].fileAccept,'.po,.po.gz');"""
if old not in s: raise SystemExit('media control expectations not found')
s=s.replace(old,new,1)

s=s.replace("assert.equal(rows[1].downloadTitle,'Save BLANK92.po');","assert.equal(rows[1].downloadTitle,'Save BLANK92.po.gz');",1)

old="""test('Liron downloads the exact HD20 backing image using its suggested .po filename',()=>{
    const downloads=[];
    const image=new Uint8Array(20971520);
    image[0]=0x11;
    image[20971519]=0xEE;
    const context=loadLiron({
        oCOM:{Download(filename,data){downloads.push({filename,data:Uint8Array.from(data)});}},
        EMU_deviceMediaRowHTML(){return '<row></row>';}
    });
    const card=new context.AppleLiron();
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960,{logicalFilename:'BLANK92.po',image});
    card.devices=[hd];
    card.getBus().attach(hd,1);

    assert.equal(typeof card.deviceToolDownload,'function');
    assert.equal(card.deviceToolDownload(1),true);
    assert.equal(downloads.length,1);
    assert.equal(downloads[0].filename,'BLANK92.po');
    assert.equal(downloads[0].data.length,20971520);
    assert.equal(downloads[0].data[0],0x11);
    assert.equal(downloads[0].data[20971519],0xEE);
});"""
new="""test('Liron gzip-downloads the exact HD20 backing image using a .po.gz filename',()=>{
    const downloads=[];
    const image=new Uint8Array(20971520);
    image[0]=0x11;
    image[20971519]=0xEE;
    const context=loadLiron({
        oCOM:{Download(filename,data){downloads.push({filename,data:Uint8Array.from(data)});}},
        EMU_deviceMediaRowHTML(){return '<row></row>';}
    });
    const card=new context.AppleLiron();
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960,{logicalFilename:'BLANK92.po',image});
    card.devices=[hd];
    card.getBus().attach(hd,1);

    assert.equal(typeof card.deviceToolDownload,'function');
    assert.equal(card.deviceToolDownload(1),true);
    assert.equal(downloads.length,1);
    assert.equal(downloads[0].filename,'BLANK92.po.gz');
    assert.equal(downloads[0].data[0],0x1F);
    assert.equal(downloads[0].data[1],0x8B);
    const inflated=Uint8Array.from(context.pako.ungzip(downloads[0].data));
    assert.equal(inflated.length,20971520);
    assert.equal(inflated[0],0x11);
    assert.equal(inflated[20971519],0xEE);
});"""
if old not in s: raise SystemExit('old HD20 download test not found')
s=s.replace(old,new,1)

old="""    assert.equal(rows[0].downloadTitle,'Save BLANK92.po',
        'download naming remains independent from the visible host filename');"""
new="""    assert.equal(rows[0].downloadTitle,'Save BLANK92.po.gz',
        'gzip download naming remains independent from the visible host filename');"""
if old not in s: raise SystemExit('host filename download-title expectation not found')
s=s.replace(old,new,1)

append = r"""

test('HD20 loads .po.gz through pako while preserving the exact host filename in the media row',()=>{
    const rows=[];
    const filenameNode={textContent:'UNFORMATTED-HD20.po'};
    const mountCalls=[];
    let hd=null;

    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }

    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        document:{getElementById(id){return id==='liron_unit_5_1_file_name' ? filenameNode : null;}},
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            mountCalls.push({length:bytes.length,slotN,deviceID,filename,unit});
            hd.loadImage(bytes,{filename});
            return true;
        },
        apple2plus:{hwObj(){return {io:{slot2ID(n){return String(n-1);},refreshDeviceToolboxes(){}}};}}
    });

    const card=new context.AppleLiron();
    card.mount={slotN:6};
    hd=new context.HD20Device();
    card.devices=[hd];
    assert.equal(hd.bindHost(card),true);

    const raw=prodosImage('BLANK92');
    const compressed=context.pako.gzip(raw);
    const file={name:'BLANK92-2.po.gz',size:compressed.length,bytes:compressed};
    const input={files:[file],value:'C:\\fakepath\\BLANK92-2.po.gz'};

    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.deepEqual(mountCalls,[{
        length:20971520,slotN:6,deviceID:'HD20',filename:'BLANK92-2.po.gz',unit:1
    }]);
    assert.equal(input.value,'C:\\fakepath\\BLANK92-2.po.gz');
    assert.equal(hd.getState().mediaFilename,'BLANK92-2.po.gz');
    assert.equal(hd.getSuggestedFilename(),'BLANK92.po');
    assert.equal(filenameNode.textContent,'BLANK92-2.po.gz');

    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].fileDisplayName,'BLANK92-2.po.gz');
    assert.equal(rows[0].downloadTitle,'Save BLANK92.po.gz');
});

test('HD20 rejects corrupt .po.gz media without mounting it',()=>{
    let mounts=0;
    const alerts=[];
    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){mounts++;return true;}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960);
    card.devices=[hd];
    card.getBus().attach(hd,1);

    const bytes=new Uint8Array([0x1F,0x8B,0x00,0x00,0x00]);
    const input={files:[{name:'BROKEN.po.gz',size:bytes.length,bytes}],value:'C:\\fakepath\\BROKEN.po.gz'};
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.equal(mounts,0);
    assert.equal(input.value,'');
    assert.ok(alerts.some(msg=>msg.includes('Unable to decompress')));
});

test('HD20 rejects a valid gzip whose expanded image is not exactly 20 MiB',()=>{
    let mounts=0;
    const alerts=[];
    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){mounts++;return true;}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960);
    card.devices=[hd];
    card.getBus().attach(hd,1);

    const compressed=context.pako.gzip(new Uint8Array(819200));
    const input={files:[{name:'TOOSMALL.po.gz',size:compressed.length,bytes:compressed}],value:'C:\\fakepath\\TOOSMALL.po.gz'};
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.equal(mounts,0);
    assert.equal(input.value,'');
    assert.ok(alerts.some(msg=>msg.includes('expand to exactly 20971520 bytes')));
});

test('HD20 strips the .po.gz wrapper when deriving a logical filename from unformatted host media',()=>{
    const context=loadLiron();
    const hd=new context.HD20Device();
    hd.loadImage(blankImage(),{filename:'BLANK92-2.po.gz'});
    assert.equal(hd.getState().mediaFilename,'BLANK92-2.po.gz');
    assert.equal(hd.getSuggestedFilename(),'BLANK92-2.po');
});
"""
if "HD20 loads .po.gz through pako" not in s:
    s += append

test.write_text(s)
