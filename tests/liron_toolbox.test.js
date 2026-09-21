const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const uniDiskSource = fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const diskIISource = fs.readFileSync('res/EMU_CARD_appledisk2.js','utf8');
const apple2ioSource = fs.readFileSync('res/EMU_apple2io.js','utf8');

function loadLiron(extra={})
{
    const context = vm.createContext(Object.assign({
        console,
        Uint8Array,
        Array,
        Number,
        String,
        Object,
        Math,
        RangeError,
        Error,
        Reflect
    },extra));
    context.oEMU = {component:{IO:{}}};
    vm.runInContext(uniDiskSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function fakeUniDisk(unit,filename)
{
    return {
        id:{
            DCODE:'UNIDISK35',
            description:'Apple UniDisk 3.5',
            deviceN:unit
        },
        getUnit(){ return unit; },
        getState(){
            return {
                unit,
                mediaLoaded:!!filename,
                mediaFilename:filename || ''
            };
        }
    };
}

test('shared removable-media row preserves the Disk II native file-control layout', () => {
    const context=vm.createContext({
        console,
        oEMU:{component:{IO:{ACTION_MAP:[]}},system:{A2P:{active:true}}},
        oEMUI:{slotConfig(){},slotsRender(){},deviceBtn(){}}
    });
    vm.runInContext(apple2ioSource,context,{filename:'EMU_apple2io.js'});

    assert.equal(typeof context.EMU_deviceMediaRowHTML,'function');
    const html=context.EMU_deviceMediaRowHTML({
        label:'Unit1',
        buttonID:'unit1_but',
        formID:'unit1_form',
        fileID:'unit1_file',
        fileName:'UNIDISK35_1',
        buttonTitle:'Unit1: eject disk',
        buttonOnClick:'ejectUnit1()',
        fileAccept:'.po',
        fileOnChange:'loadUnit1(this)',
        downloadID:'unit1_dump',
        downloadDisabled:true,
        downloadTitle:'Save disk (not implemented yet)'
    });

    assert.match(html,/class=appbut style="padding:5px 0px 0px 0px;text-align:left/);
    assert.match(html,/type=button method=get class=appbut/);
    assert.match(html,/value="Unit1"/);
    assert.match(html,/<form action="index\.html"/);
    assert.match(html,/type="file"/);
    assert.match(html,/id="unit1_file"/);
    assert.match(html,/style="display:inline-block"/,
        'the native file input must remain visible exactly as in the Disk II row');
    assert.match(html,/accept="\.po"/);
    assert.match(html,/fa fa-cloud-download-alt/);
    assert.match(html,/disabled/);
    assert.doesNotMatch(html,/>Load</);
    assert.doesNotMatch(html,/>Eject</);
    assert.doesNotMatch(html,/No disk/);
});

test('shared media row can show a managed hard-disk filename instead of browser no-file-selected text', () => {
    const context=vm.createContext({
        console,
        oEMU:{component:{IO:{ACTION_MAP:[]}},system:{A2P:{active:true}}},
        oEMUI:{slotConfig(){},slotsRender(){},deviceBtn(){}}
    });
    vm.runInContext(apple2ioSource,context,{filename:'EMU_apple2io.js'});

    const html=context.EMU_deviceMediaRowHTML({
        label:'Unit1',
        fileID:'hd20_file',
        fileName:'HD20_1',
        fileDisplayName:'HD20.po',
        fileAccept:'.po',
        fileOnChange:'loadHD20(this)',
        downloadID:'hd20_dump',
        downloadOnClick:'downloadHD20()',
        downloadTitle:'Save HD20.po'
    });

    assert.match(html,/type="file"[^>]*id="hd20_file"[^>]*style="display:none"/,
        'managed filename mode keeps a real file input but hides the browser-owned filename presentation');
    assert.match(html,/for="hd20_file"[^>]*>Choose File<\/label>/,
        'the synthetic Choose File control must still activate the real file input');
    assert.match(html,/id="hd20_file_name"[^>]*>HD20\.po<\/span>/,
        'the logical hard-disk filename must be visible even before a host file was selected');
    assert.doesNotMatch(html,/disabled/,
        'HD20 download remains enabled when the media was created internally');
    assert.match(html,/onclick="downloadHD20\(\)"/);
});

test('Disk II and Liron use the same shared removable-media row renderer', () => {
    assert.match(diskIISource,/EMU_deviceMediaRowHTML\s*\(/,
        'Disk II must render its drive rows through the shared media-row helper');
    assert.match(source,/EMU_deviceMediaRowHTML\s*\(/,
        'Liron must render its SmartPort unit rows through the same helper');
});

test('Liron toolbox renders attached SmartPort units vertically through the Disk II row layout', () => {
    const rowCalls=[];
    const context = loadLiron({
        EMU_deviceMediaRowHTML(spec)
        {
            rowCalls.push(spec);
            return `<div class="shared-media-row" data-label="${spec.label}"></div>`;
        }
    });
    const card = new context.AppleLiron();
    const unit1 = fakeUniDisk(1,'CardCat 1.94.po');
    const unit2 = fakeUniDisk(2,'TOOLS.po');
    card.devices = [unit1,unit2];

    const html = card.deviceToolSlotHTML({
        slotN:6,
        slotID:'5',
        toolboxID:'device_tool_5',
        devices:card.devices
    });

    assert.equal(rowCalls.length,2);
    assert.deepEqual(rowCalls.map(row => row.label),['Unit1','Unit2']);
    assert.ok(html.indexOf('data-label="Unit1"') < html.indexOf('data-label="Unit2"'),
        'SmartPort unit rows must remain vertically ordered');

    for(let i=0;i<rowCalls.length;i++)
    {
        const unit=i+1;
        const row=rowCalls[i];
        assert.equal(row.fileName,'UNIDISK35_'+unit);
        assert.match(row.fileOnChange,new RegExp(`deviceToolLoadFile\\(this,${unit}\\)`));
        assert.match(row.buttonOnClick,new RegExp(`deviceToolEject\\(${unit}\\)`));
        assert.equal(row.downloadDisabled,true,
            'a non-exportable fake UniDisk remains disabled');
    }
});

test('loaded UniDisk media enables download and exports the exact .po image', () => {
    const rows=[];
    const downloads=[];
    const context=loadLiron({
        oCOM:{Download(filename,data){downloads.push({filename,data:Uint8Array.from(data)});}},
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row></row>';}
    });
    const card=new context.AppleLiron();
    const disk=new context.UniDisk35Device();
    assert.equal(disk.bindHost(card),true);
    const image=new Uint8Array(819200);
    image[0]=0x11;
    image[819199]=0xEE;
    disk.loadImage(image,{filename:'ProDOS Packer 6.0.po'});
    card.devices=[disk];

    assert.equal(disk.getSuggestedFilename(),'ProDOS Packer 6.0.po');
    assert.notEqual(disk.getImage(),image,'export must return a copy of the mounted media buffer');

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows.length,1);
    assert.equal(rows[0].downloadDisabled,false,
        'a loaded UniDisk must enable the existing download button');
    assert.match(rows[0].downloadOnClick,/deviceToolDownload\(1\)/);
    assert.equal(rows[0].downloadTitle,'Save ProDOS Packer 6.0.po');

    assert.equal(card.deviceToolDownload(1),true);
    assert.equal(downloads.length,1);
    assert.equal(downloads[0].filename,'ProDOS Packer 6.0.po');
    assert.equal(downloads[0].data.length,819200);
    assert.equal(downloads[0].data[0],0x11);
    assert.equal(downloads[0].data[819199],0xEE);
});

test('Liron schedules a machine restart after a live SmartPort topology change', () => {
    let restarts=0;
    const warnings=[];
    const context=loadLiron({
        console:{log(){},error(){},warn(msg){warnings.push(String(msg));}},
        setTimeout(fn){fn();return 1;},
        apple2plus:{restart(){restarts++;}}
    });
    const card=new context.AppleLiron();

    assert.equal(typeof card.onDeviceTopologyChanged,'function');
    assert.equal(card.onDeviceTopologyChanged({type:'attach',DCODE:'UNIDISK35'}),true);
    assert.equal(restarts,1,
        'live SmartPort attach must reboot so ProDOS rebuilds its boot-time device table');
    assert.ok(warnings.some(msg=>msg.includes('SmartPort topology changed')));
});

test('successful Liron file load keeps the native file selection so the browser displays the filename', () => {
    const mountCalls=[];
    const refreshCalls=[];

    class FakeFileReader
    {
        readAsArrayBuffer(file)
        {
            this.onload({target:{result:file.bytes.buffer}});
        }
    }

    const context = loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            mountCalls.push({bytes:Array.from(bytes),slotN,deviceID,filename,unit});
            return true;
        },
        apple2plus:{
            hwObj(){
                return {io:{
                    slot2ID(slotN){return String(slotN-1);},
                    refreshDeviceToolboxes(arg){refreshCalls.push(arg);}
                }};
            }
        }
    });

    const card = new context.AppleLiron();
    card.mount={slotN:6};
    card.devices=[fakeUniDisk(1,''),fakeUniDisk(2,'')];

    const file={
        name:'ProDOS Packer 6.0.po',
        size:819200,
        bytes:new Uint8Array(819200)
    };
    const input={files:[file],value:'C:\\fakepath\\ProDOS Packer 6.0.po'};

    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.equal(mountCalls.length,1);
    assert.equal(mountCalls[0].slotN,6);
    assert.equal(mountCalls[0].deviceID,'UNIDISK35');
    assert.equal(mountCalls[0].filename,'ProDOS Packer 6.0.po');
    assert.equal(mountCalls[0].unit,1);
    assert.equal(mountCalls[0].bytes.length,819200);
    assert.equal(input.value,'C:\\fakepath\\ProDOS Packer 6.0.po',
        'successful mounts must leave the native file input populated');
    assert.equal(refreshCalls.length,1,'toolbox selection may refresh without rebuilding its media row');
});
