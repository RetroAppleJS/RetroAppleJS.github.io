//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_hostio.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"board":null}}}
else 
{
    //oEMU.component.IO.board= new AppleBoard();
    oEMU.component.IO.board = null;
}


function AppleBoard()
{
    this.id    = {"PCODE":"A2BO", "icon":"fa fa-home", "slotLock":true};
    this.state = {"active":true};
    this.action = 
    { 
         "HostIO" :{ "RD":{"callback":read.bind(this)}
                    ,"WR":{"callback":write.bind(this)}}                                      // by default always 16 bytes
    }

    function read()  {}
    function write() {}


    this.IO_map = function(model)
    {
        function isRO(ctx) { return ctx && ctx.bRO === true; }

        // hack - TODO: find a permanent fix
        const IOMAP_CALLS = {
            "KBD":      function(ctx2){ return isRO(ctx2) ? ctx2.keys.lastkey : ctx2.keys.polling(ctx2.keys.lastkey); },
            "KBDSTRB":  function(ctx2){ if(!isRO(ctx2)) ctx2.keys.strobe();       return 0x00; },
            "SPKR":     function(ctx2){ if(!isRO(ctx2)) ctx2.snd.toggle();        return 0x00; },

            "TXTCLR":   function(ctx){ if(!isRO(ctx)) ctx.vid.setGfx(true);       return 0x00; },
            "TXTSET":   function(ctx){ if(!isRO(ctx)) ctx.vid.setGfx(false);      return 0x00; },
            "MIXCLR":   function(ctx){ if(!isRO(ctx)) ctx.vid.setMix(false);      return 0x00; },
            "MIXSET":   function(ctx){ if(!isRO(ctx)) ctx.vid.setMix(true);       return 0x00; },
            "TXTPAGE1": function(ctx){ if(!isRO(ctx)) ctx.vid.setPage2(false);    return 0x00; },
            "TXTPAGE2": function(ctx){ if(!isRO(ctx)) ctx.vid.setPage2(true);     return 0x00; },
            "LORES":    function(ctx){ if(!isRO(ctx)) ctx.vid.setHires(false);    return 0x00; },
            "HIRES":    function(ctx){ if(!isRO(ctx)) ctx.vid.setHires(true);     return 0x00; }
        };
  
        var IOMAP_ID = null;
        update_IORANGES(model);

        // READ SYSTEM-SPECIFIC I/O RANGES and update oEMU
        function update_IORANGES(sys_model)
        {
            if(oEMU.system===undefined) return;
            for(var o in _CFG_IORANGES)
            {
                if(syscode_has_model(o,sys_model))
                {
                    oEMU.system["IORANGES"] = _CFG_IORANGES[o];

                    oEMU.system["IORANGES-SLOT"] = {};
                    for(var r in _CFG_IORANGES[o])
                    {
                        oEMU.system["IORANGES-SLOT"][r] = oCOM.parseRngExpr(_CFG_IORANGES[o][r],{n:3});
   
                    }
                    break;
                }
                IOMAP_ID++;
            }
        }

        function syscode_has_model(syscodes,sys_model)
        {
            if(!syscodes || !sys_model) return false;

            var needle = String(sys_model).toUpperCase();
            var list = String(syscodes)
                .replace(/<br\s*\/?\s*>/gi,"")
                .split(",");

            for(var i=0;i<list.length;i++)
            {
                if(oCOM.trim(list[i]).toUpperCase()===needle) return true;
            }
            return false;
        }

        function ioaddr_from_key(key)
        {
            var m = /^\$([0-9A-Fa-f]{4})/.exec(key);
            return m ? m[1].toUpperCase() : null;
        }

        function behavior_list(behaviors)
        {
            if(!behaviors) return [];
            var arr = String(behaviors).split(",");
            for(var i=0;i<arr.length;i++) arr[i] = oCOM.trim(arr[i]);
            return arr;
        }

        var IOMAP_TBL = [];
        var iomap_rows = [];
        var output = {"WR":{},"RD":{},"RR":{},"SV":{},"VA":{},"BT":{},"RG":{}};

        for(var key in _CFG_IOADDR)
        {
            var row = _CFG_IOADDR[key];
            var addr = ioaddr_from_key(key);
            if(addr===null) continue;

            var addr_n = parseInt(addr,16)-0xC000;
            var name = row.Name || "";
            var iomap_str = row.SYScode || "";
            var act_name_str = row.Behaviors || "";
            var desc = row.Description || "";
            var model_match = syscode_has_model(iomap_str,model);
 
            IOMAP_TBL.push(["0x"+addr,name,iomap_str,act_name_str,desc]);
            iomap_rows.push({
                addr: "0x"+addr,
                addr_n: addr_n,
                name: name,
                systems: iomap_str,
                act: act_name_str,
                desc: desc,
                model_match: model_match
            });

            var cm = IOMAP_CALLS[IOMAP_ID]===undefined || IOMAP_CALLS[IOMAP_ID][name]===undefined
                ? null
                : IOMAP_CALLS[IOMAP_ID][name];

            if(model_match && cm!=null && (cm.ST!=null || cm!=null))
            {
                var acts = behavior_list(act_name_str);
                if(acts.indexOf("WR")>=0) output.WR[addr_n] = cm; // WRITE
                if(acts.indexOf("RR")>=0) output.RR[addr_n] = cm; // DOUBLE READ
                else if(acts.indexOf("RD")>=0) output.RD[addr_n] = cm; // READ
                if(acts.indexOf("BI")>=0) output.BT[addr_n] = cm; // BIT
                if(acts.indexOf("RG")>=0) output.RG[addr_n] = cm; // REGISTER
                console.log(addr,addr_n,name,act_name_str,desc,cm);
            }
            
        }

       //console.table(IOMAP_TBL);
       //console.log(JSON.stringify(iomap_rows)) 

        this.IOMAP_ROWS = iomap_rows;
    


        const SOFTSWITCH_50 = 
        {
            0x0: IOMAP_CALLS["TXTCLR"],
            0x1: IOMAP_CALLS["TXTSET"],
            0x2: IOMAP_CALLS["MIXCLR"],
            0x3: IOMAP_CALLS["MIXSET"],
            0x4: IOMAP_CALLS["TXTPAGE1"],
            0x5: IOMAP_CALLS["TXTPAGE2"],
            0x6: IOMAP_CALLS["LORES"],
            0x7: IOMAP_CALLS["HIRES"]
        };

        var output = {
            "BT":{},
            "RD":
            {
                 0x00: function(rel_addr,ctx) { return IOMAP_CALLS["KBD"](ctx) }
                ,0x10: function(rel_addr,ctx) { return IOMAP_CALLS["KBDSTRB"](ctx) }
                ,0x30: function(rel_addr,ctx) { return IOMAP_CALLS["SPKR"](ctx) }
                ,0x50: function(rel_addr,ctx)
                {
                    const fn = SOFTSWITCH_50[rel_addr];
                    return fn ? fn(ctx) : 0x00;
                }
            },
            "RG":{},
            "RR":{},
            "SV":{},
            "VA":{},
            "WR":
            {
                 0x10: function(rel_addr,d8,ctx) { return IOMAP_CALLS["KBDSTRB"](ctx) }
            ,0x50: function(rel_addr,d8,ctx)
            {
                const fn = SOFTSWITCH_50[rel_addr];
                return fn ? fn(ctx) : 0x00;
            }
            }
        }


        return output;
        
    }


    this.getBoardIORows = function(model)
    {
        model = model || (typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P");

        this.IO_map(model,{});   // refresh parsed rows for this model

        return (this.IOMAP_ROWS || []).filter(function(r){
            return r.model_match
                && r.addr_n < 0x80
                && (r.act.indexOf("RD") >= 0 || r.act.indexOf("RR") >= 0);
        });
    }

    this.boardIO_html = function(model)
    {
        var rows = this.getBoardIORows(model);

        var s = '<div style="margin-top:6px;">'
            + '<table style="width:100%;border-collapse:collapse;font-size:11px;">'
            + '<tr>'
            + '<th style="text-align:left;padding:2px 4px;">Addr</th>'
            + '<th style="text-align:left;padding:2px 4px;">Name</th>'
            + '<th style="text-align:left;padding:2px 4px;">Act</th>'
            + '<th style="text-align:left;padding:2px 4px;">Description</th>'
            + '</tr>';

        for(var i=0;i<rows.length;i++)
        {
            s += '<tr>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].addr)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].name)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].act)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].desc)+'</td>'
            + '</tr>';
        }

        s += '</table></div>';
        return s;
    }

    this.deviceList_html = function(model)
    {

 
                  
  var ct = ""; 

//oApple2Video.renderModes[0].ctor 

//oApple2Video.renderModes[0].ctor.ctrl_dlg()

                 var rows = [
                     {"name":"<div style=\"display: inline-block;white-space: nowrap;\"><i class=\"fa fa-eye\"></i>&nbsp;"+oApple2Video.renderModes[0].name+"</div>","ctrl":ct}
                    ,{"name":"<div style=\"display: inline-block;white-space: nowrap;\"><i class=\"fa fa-eye\"></i>&nbsp;"+oApple2Video.renderModes[1].name+"</div>","ctrl":ct}
                    ,{"name":"<div style=\"display: inline-block;white-space: nowrap;\"><i class=\"fa fa-eye\"></i>&nbsp;"+oApple2Video.renderModes[2].name+"</div>","ctrl":ct}
                    ,{"name":"<div style=\"display: inline-block;white-space: nowrap;\"><i class=\"fa fa-eye\"></i>&nbsp;"+oApple2Video.renderModes[3].name+"</div>","ctrl":ct}
                ];

                var s = '<div style="max-height:420px;overflow:auto;margin-top:6px;">'
            + '<table style="width:100%;border-collapse:collapse;font-size:11px;">'
            + '<tr>'
            + '<th style="text-align:left;padding:2px 4px;">Device</th>'
            + '<th style="text-align:left;padding:2px 4px;">Controls</th>'
            + '</tr>';

        for(var i=0;i<rows.length;i++)
        {
            s += '<tr>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+rows[i].name+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+rows[i].ctrl+'</td>'
            + '</tr>';
        }

        s += '</table></div>';
        return s;

    }
}
