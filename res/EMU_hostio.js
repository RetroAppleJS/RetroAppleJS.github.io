//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_hostio.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"board":new AppleBoard()}}}
else oEMU.component.IO.board= new AppleBoard();


function AppleBoard()
{
    this.id    = {"PCODE":"BOARD", "icon":"fa fa-tv"};
    this.state = {"active":true,"slot":null};
    this.action = 
    { 
         "HostIO" :{ "RD":{"callback":read.bind(this)}
                    ,"WR":{"callback":write.bind(this)}}                                      // by default always 16 bytes
    }

    function read() {alert("test")}
    function write() {}


    this.IO_map = function(model,IOMAP_CALLS)
    {



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

            if(IOMAP_CALLS)
            {
                var cm = IOMAP_CALLS[IOMAP_ID]===undefined || IOMAP_CALLS[IOMAP_ID][name]===undefined ? null : IOMAP_CALLS[IOMAP_ID][name];

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
            else console.warn("IO_map() without IOMAP_CALLS")
        }

        console.table(IOMAP_TBL);
        console.log(JSON.stringify(iomap_rows)); 

        this.IOMAP_ROWS = iomap_rows;
        return output;
    }

    this.getBoardIORows = function(model)
    {
        model = model || (typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P");

        
        this.IO_map(model);   // refresh parsed rows for this model

        return (apple2plus.hwObj().io.IOMAP_ROWS || []).filter(function(r){
            return r.model_match
                && r.addr_n < 0x80
                && (r.act.indexOf("RD") >= 0 || r.act.indexOf("RR") >= 0);
        });
    }

    this.boardIO_html = function(model)
    {
        var rows = this.getBoardIORows(model);

        var s = '<div style="max-height:420px;overflow:auto;margin-top:6px;">'
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
}