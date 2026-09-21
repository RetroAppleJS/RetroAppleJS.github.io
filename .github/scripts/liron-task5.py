from pathlib import Path
import sys

mode=sys.argv[1] if len(sys.argv)>1 else 'all'

TEST_SOURCE=r'''\
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const deviceSource=fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const cardSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

function loadCard(extra={})
{
    const context=vm.createContext(Object.assign({
        console,
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        EMU_deviceMediaRowHTML(){return '';}
    },extra));
    context.oEMU={component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}};
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function mountedDisk(context,hash=0x9B05)
{
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const disk=new context.UniDisk35Device(card.deviceConfig[0]);
    disk.attach={hash};
    assert.equal(disk.bindHost(card),true);
    card.devices=[disk];
    return {card,disk};
}

test('index owns an independent scoped Liron surface-map popup',()=>{
    assert.match(indexSource,/id=["']lironSurfaceMap_popup["']/);
    assert.match(indexSource,/id=["']lironSurfaceMap_popup_text["']/);
    assert.match(indexSource,/addScope\(["']lironSurfaceMap_popup["'],["']tab1\.2["']\)/);
    assert.match(indexSource,/\.liron-surface-grid/);
});

test('UniDisk surface map renders two 80 by 12 sides with exactly 1600 active 512-byte sectors',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});
    const html=card.deviceToolSurfaceMapHTML(1,0x9B05);

    assert.match(html,/Disk Surface Map — UNIDISK Unit1/);
    assert.match(html,/Instance #9B05 · 800 KB · 1600 × 512-byte sectors/);
    assert.ok(html.indexOf('data-side="0"') < html.indexOf('data-side="1"'));
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,1920);
    assert.equal((html.match(/data-active="1"/g)||[]).length,1600);
    assert.equal((html.match(/data-active="0"/g)||[]).length,320);
    assert.equal((html.match(/data-zone-end="1"/g)||[]).length,96);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,1600);
    assert.equal(new Set(blocks).size,1600);
    assert.deepEqual(blocks.slice().sort((a,b)=>a-b),Array.from({length:1600},(_,i)=>i));
    assert.match(html,/data-offset="0"/);
    assert.match(html,/data-offset="818688"/);
    assert.match(html,/title="Side 1 · Track 27 · Sector 8 · 512 bytes"/);
});

test('UniDisk surface map keeps exact instance identity and handles stale or empty media explicitly',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    let html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    assert.match(html,/No media loaded/);
    assert.doesNotMatch(html,/data-surface-cell=/);

    disk.attach.hash=0xBEEF;
    html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    assert.match(html,/Device instance is no longer attached/);
    assert.doesNotMatch(html,/data-surface-cell=/);
});

test('open UniDisk popup refreshes the same instance to no-media after eject',()=>{
    const popup={hidden:true};
    const text={innerHTML:''};
    const context=loadCard({
        document:{getElementById(id){return id==='lironSurfaceMap_popup'?popup:(id==='lironSurfaceMap_popup_text'?text:null);}},
        oCOM:{POPUP:{on(id){assert.equal(id,'lironSurfaceMap_popup');popup.hidden=false;return popup;}}}
    });
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});

    assert.equal(card.deviceToolSurfaceMap(1,0x9B05),true);
    assert.equal(popup.hidden,false);
    assert.match(text.innerHTML,/data-surface-cell=/);
    disk.ejectImage();
    assert.equal(card.deviceToolSurfaceMapRefresh(),true);
    assert.match(text.innerHTML,/No media loaded/);
});
'''

def write_tests():
    Path('tests/liron_surface_map.test.js').write_text(TEST_SOURCE)


def implement():
    p=Path('res/EMU_CARD_LIRON.js')
    s=p.read_text()
    state_marker='    var iwm = new LironIWM(smartport);\n'
    if 'var deviceSurfaceMapState' not in s:
        if state_marker not in s: raise SystemExit('surface state marker missing')
        s=s.replace(state_marker,state_marker+'    var deviceSurfaceMapState = {"unit":null,"hash":null};\n',1)

    sync_old='''        if(options.clearFile) { var file=document.getElementById(controlID+"_file"); if(file) try { file.value=""; } catch(e) {} }
        return true;
    };

    this.deviceToolSlotHTML = function(ctx)'''
    methods='''        if(options.clearFile) { var file=document.getElementById(controlID+"_file"); if(file) try { file.value=""; } catch(e) {} }
        if(deviceSurfaceMapState.unit===unit) liron.deviceToolSurfaceMapRefresh();
        return true;
    };

    function deviceToolSurfaceTarget(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(expectedHash)) return null;
        var device=deviceToolUnitDevice(unit);
        if(!device || device.id?.DCODE!=="UNIDISK" || typeof(device.getSurfaceMapGeometry)!=="function") return null;
        if(Number(device.attach?.hash)!==expectedHash) return null;
        return device;
    }

    this.deviceToolSurfaceMapHTML = function(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        var label="UNIDISK Unit"+unit;
        var title="<div class=\\"liron-surface-title\\">Disk Surface Map — "+label+"</div>";
        var device=deviceToolSurfaceTarget(unit,expectedHash);
        if(!device)
            return title+"<div class=\\"liron-surface-status\\">Device instance is no longer attached.</div>";

        var instance=deviceToolInstanceHex(device) || "????";
        var state=typeof(device.getState)==="function" ? device.getState() || {} : {};
        var meta="<div class=\\"liron-surface-meta\\">Instance #"+instance+" · 800 KB · 1600 × 512-byte sectors</div>";
        if(!state.mediaLoaded)
            return title+meta+"<div class=\\"liron-surface-status\\">No media loaded.</div>";

        var out=title+meta+"<div class=\\"liron-surface-panels\\">";
        for(var side=0;side<2;side++)
        {
            out += "<section class=\\"liron-surface-side\\" data-side=\\""+side+"\\"><div class=\\"liron-surface-side-title\\">Side "+side+"</div><div class=\\"liron-surface-grid\\">";
            for(var sector=0;sector<12;sector++)
            {
                for(var track=0;track<80;track++)
                {
                    var count=device.getSurfaceTrackSectorCount(track);
                    var active=sector<count;
                    var zoneEnd=track===15 || track===31 || track===47 || track===63;
                    if(active)
                    {
                        var block=device.surfaceSectorToBlock(side,track,sector);
                        var offset=block*512;
                        out += "<span class=\\"liron-surface-cell active"+(zoneEnd?" zone-end":"")+"\\" data-surface-cell=\\"1\\" data-active=\\"1\\" data-side=\\""+side+"\\" data-track=\\""+track+"\\" data-sector=\\""+sector+"\\" data-block=\\""+block+"\\" data-offset=\\""+offset+"\\""+(zoneEnd?" data-zone-end=\\"1\\"":"")+" title=\\"Side "+side+" · Track "+track+" · Sector "+sector+" · 512 bytes\\"></span>";
                    }
                    else
                    {
                        out += "<span class=\\"liron-surface-cell inactive"+(zoneEnd?" zone-end":"")+"\\" data-surface-cell=\\"1\\" data-active=\\"0\\" data-side=\\""+side+"\\" data-track=\\""+track+"\\" data-sector=\\""+sector+"\\""+(zoneEnd?" data-zone-end=\\"1\\"":"")+" title=\\"Side "+side+" · Track "+track+" · Sector "+sector+" · not present\\"></span>";
                    }
                }
            }
            out += "</div></section>";
        }
        return out+"</div>";
    };

    this.deviceToolSurfaceMapRefresh = function()
    {
        if(!Number.isInteger(deviceSurfaceMapState.unit) || !Number.isInteger(deviceSurfaceMapState.hash)) return false;
        if(typeof(document)==="undefined" || !document.getElementById) return false;
        var popup=document.getElementById("lironSurfaceMap_popup");
        var text=document.getElementById("lironSurfaceMap_popup_text");
        if(!popup || !text) return false;
        text.innerHTML=liron.deviceToolSurfaceMapHTML(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        return true;
    };

    this.deviceToolSurfaceMap = function(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(expectedHash)) return false;
        deviceSurfaceMapState.unit=unit;
        deviceSurfaceMapState.hash=expectedHash;
        if(!liron.deviceToolSurfaceMapRefresh()) return false;
        var popup=document.getElementById("lironSurfaceMap_popup");
        if(typeof(oCOM)==="object" && oCOM && oCOM.POPUP && typeof(oCOM.POPUP.on)==="function") oCOM.POPUP.on("lironSurfaceMap_popup");
        else popup.hidden=false;
        return true;
    };

    this.deviceToolSlotHTML = function(ctx)'''
    if 'this.deviceToolSurfaceMapHTML' not in s:
        if sync_old not in s: raise SystemExit('surface method insertion marker missing')
        s=s.replace(sync_old,methods,1)
    p.write_text(s)

    idx=Path('index.html')
    h=idx.read_text()
    css='''\n    <style id="lironSurfaceMap_style">\n      #lironSurfaceMap_popup { box-sizing:border-box; overflow:hidden; }\n      #lironSurfaceMap_popup .liron-surface-title { font-weight:bold; padding:2px 0 4px 0; }\n      #lironSurfaceMap_popup .liron-surface-meta { padding:0 0 7px 0; }\n      #lironSurfaceMap_popup .liron-surface-status { padding:12px 4px; }\n      #lironSurfaceMap_popup .liron-surface-panels { display:flex; gap:10px; width:100%; }\n      #lironSurfaceMap_popup .liron-surface-side { flex:1 1 0; min-width:0; }\n      #lironSurfaceMap_popup .liron-surface-side-title { text-align:center; padding-bottom:3px; }\n      #lironSurfaceMap_popup .liron-surface-grid { display:grid; grid-template-columns:repeat(80,minmax(3px,1fr)); grid-template-rows:repeat(12,8px); gap:1px; width:100%; overflow:hidden; }\n      #lironSurfaceMap_popup .liron-surface-cell { min-width:0; height:8px; box-sizing:border-box; border:1px solid rgba(0,0,0,0.35); }\n      #lironSurfaceMap_popup .liron-surface-cell.active { background:rgba(0,0,0,0.38); }\n      #lironSurfaceMap_popup .liron-surface-cell.inactive { opacity:0.12; }\n      #lironSurfaceMap_popup .liron-surface-cell.zone-end { border-right-width:2px; }\n    </style>\n'''
    if 'id="lironSurfaceMap_style"' not in h:
        if '</head>' not in h: raise SystemExit('head close marker missing')
        h=h.replace('</head>',css+'</head>',1)
    popup='''\n  <div class="appbox" id="lironSurfaceMap_popup" style="position:absolute;z-index:3;left:350px;top:120px;width:930px;max-width:calc(100vw - 370px);text-align:left;padding:7px;margin:0px" hidden="">\n    <div class="appbut" onclick="oCOM.POPUP.off('lironSurfaceMap_popup')" style="text-align:center;float:right;cursor:pointer">x</div>\n    <div id="lironSurfaceMap_popup_text"></div>\n  </div>\n\n'''
    if 'id="lironSurfaceMap_popup"' not in h:
        marker='  <table id=box'
        if marker not in h: raise SystemExit('popup host marker missing')
        h=h.replace(marker,popup+marker,1)
    scope='                        oCOM.POPUP.addScope("surfaceMap_popup","tab1.2");\n'
    if 'oCOM.POPUP.addScope("lironSurfaceMap_popup","tab1.2")' not in h:
        if scope not in h: raise SystemExit('popup scope marker missing')
        h=h.replace(scope,scope+'                        oCOM.POPUP.addScope("lironSurfaceMap_popup","tab1.2");\n',1)
    idx.write_text(h)

if mode in ('tests','all'):
    write_tests()
if mode in ('impl','all'):
    implement()
