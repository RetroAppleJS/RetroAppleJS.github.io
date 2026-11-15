// Disk II D1_DIR URL loader: HTTP errors must not throw or silently restart.
// Run: node --test tests/d1_dir_http_errors.test.js
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const source=fs.readFileSync(path.join(__dirname,"../res/EMU_apple2main.js"),"utf8");
const start=source.indexOf('case "D1_DIR":');
const stop=source.indexOf("            break;",start);
assert.ok(start>=0 && stop>start,"D1_DIR handler not found");
const runCase=new Function("oCOM","_o","pako","btoa","console","document","apple2plus",
    "TextDecoder",
    'switch ("D1_DIR") {\n'+source.slice(start,stop+"            break;".length)+'\n}');

function fixture(responseStatus,body,options={})
{
    const events={urls:[],logs:[],restarts:0,networkHandler:null,download:null};
    const oCOM={
        URL:{uri:{D1_DIR:options.path||"ProDos/ProDOS_8_JPlus.dsk",boot:options.boot?"1":undefined}},
        POPUP:{set_class(){}},
        GetHTTP(url,kind,handler,arg,errorHandler)
        {
            events.urls.push(url);
            assert.equal(kind,"arraybuffer");
            events.networkHandler=errorHandler;
            events.download=handler;
            if(options.networkError) errorHandler.call({status:0});
            else handler.call({status:responseStatus,response:body});
        }
    };
    const memory={};
    const pako={Deflate:class {
        constructor(){this.result=new Uint8Array(0);}
        push(){this.result=new Uint8Array([1,2,3]);}
    }};
    const doc={getElementById:()=>({})};
    const cpu={restart(){events.restarts++;}};
    const logger={
        error(...args){events.logs.push(args.map(x=>String(x)).join(" "));}
    };
    assert.doesNotThrow(()=>runCase(oCOM,memory,pako,()=>"",logger,doc,cpu,TextDecoder));
    return {events,memory};
}

test("HTTP 404 reports the disk path and original HTTP error without ui8 exception",()=>{
    const response=new TextEncoder().encode("404: Not Found").buffer;
    const {events,memory}=fixture(404,response,{boot:true});
    assert.equal(events.urls[0],
        "https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/ProDos/ProDOS_8_JPlus.dsk");
    assert.match(events.logs.join(" "),/HTTP 404/);
    assert.match(events.logs.join(" "),/ProDos\/ProDOS_8_JPlus\.dsk/);
    assert.match(events.logs.join(" "),/404: Not Found/);
    assert.equal(memory.D1_buffer,undefined);
    assert.equal(events.restarts,0);
});

test("HTTP 200 with short response is reported as invalid disk content",()=>{
    const {events,memory}=fixture(200,new ArrayBuffer(4),{boot:true});
    assert.match(events.logs.join(" "),/HTTP 200/);
    assert.equal(memory.D1_buffer,undefined);
    assert.equal(events.restarts,0);
});

test("HTTP 500 with null response is handled safely",()=>{
    const {events,memory}=fixture(500,null);
    assert.match(events.logs.join(" "),/HTTP 500/);
    assert.equal(memory.D1_buffer,undefined);
});

test("network timeout/error reports the request URL without staging or restarting",()=>{
    const {events,memory}=fixture(0,null,{networkError:true,boot:true});
    assert.match(events.logs.join(" "),/network error or request timeout/);
    assert.equal(memory.D1_buffer,undefined);
    assert.equal(events.restarts,0);
});

test("valid D1_DIR disk still stages media and triggers boot as before",()=>{
    const {events,memory}=fixture(200,new ArrayBuffer(143360),{boot:true});
    assert.equal(events.restarts,1);
    assert.equal(memory.D1_buffer.length,143360);
    assert.deepEqual(events.logs,[]);
});

test("valid D1_DIR disk without boot does not cold-restart the machine",()=>{
    const {events,memory}=fixture(200,new ArrayBuffer(143360),{boot:false});
    assert.equal(events.restarts,0);
    assert.equal(memory.D1_buffer.length,143360);
});

test("case-sensitive repo directories are not silently renamed by the loader",()=>{
    const f=fixture(404,new TextEncoder().encode("Not Found").buffer,{
        path:"ProDOS/ProDOS_8_JPlus.dsk"
    });
    assert.match(f.events.urls[0],/\/disks\/ProDOS\/ProDOS_8_JPlus\.dsk$/);
    assert.match(f.events.logs[0],/case-sensitive path/);
});
