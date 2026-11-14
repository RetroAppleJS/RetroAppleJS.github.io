/* Configurable SYSTEM popup, attached to the shared oCOM.POPUP state machine.
 * Uses STEP TRACE's anchor and maximum width; content determines height.
 * Wide tables scroll inside the compact dialog.
 */
var EMU_SYSTEM_CONFIG = (function()
{
    "use strict";
    var popupID="EMU_system_config_popup",draft=null,model=null,notice="";
    var fields=["CPU","Speeds","Display","Slotslogphy","ROM","KeyFont"];
    var headings={CPU:"CPU",Speeds:"Speed (MHz)",Display:"Display",Slotslogphy:"Slots log/phy",ROM:"ROM",KeyFont:"Key font"};

    function html(s)
    {
        return String(s==null ? "" : s).replace(/[&<>"']/g,function(c)
        {
            return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
        });
    }

    function snapshot()
    {
        draft=Object.create(null);
        EMU_system_modelCodes().forEach(function(code)
        {
            draft[code]=EMU_system_getConfiguration(code);
        });
        model=(typeof(EMU_system_get)==="function" && EMU_system_get()) || "A2P";
        notice="";
    }

    function position()
    {
        var p=document.getElementById(popupID);
        if(!p) return;
        var dbg=document.getElementById("cpuDbg_popup");
        var host=document.getElementById("feature_box");
        var r=null;
        if(dbg && typeof(dbg.getBoundingClientRect)==="function")
        {
            // Hidden popups have zero dimensions. Measure synchronously while
            // invisible, without changing oCOM.POPUP's saved open/close state.
            var hidden=dbg.hidden,oldVisibility=dbg.style.visibility;
            try
            {
                if(hidden) { dbg.style.visibility="hidden"; dbg.hidden=false; }
                r=dbg.getBoundingClientRect();
            }
            finally
            {
                if(hidden) dbg.hidden=true;
                dbg.style.visibility=oldVisibility;
            }
        }
        if(!r || !r.width)
            r=host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
        var vw=window.innerWidth || 1280,vh=window.innerHeight || 800;
        var left=r && Number.isFinite(r.left) ? r.left : 700;
        var top=r && Number.isFinite(r.top) ? r.top : 120;
        var width=r && r.width>=280 ? Math.round(r.width) : 350;
        left=Math.max(4,Math.min(left,vw-Math.min(width,vw-8)-4));
        top=Math.max(4,Math.min(top,vh-160));
        p.style.left=Math.round(left)+"px";
        p.style.top=Math.round(top)+"px";
        p.style.width=Math.min(width,vw-8)+"px";
        // Do not stretch a two-row table to STEP TRACE's fixed height.
        // CSS caps the scroll region if more model options become available.
        p.style.height="auto";
        p.style.maxHeight=Math.max(160,vh-top-4)+"px";
    }

    function cell(code,field)
    {
        var options=EMU_system_options(code,field);
        if(!options.length) return '<span class="sysconfig-empty">—</span>';
        if(options.length===1) return '<span>'+html(options[0])+'</span>';
        return options.map(function(value,index)
        {
            return '<label class="sysconfig-option"><input type="radio"'
                +' name="sysconfig_'+html(code)+'_'+html(field)+'"'
                +' data-model="'+html(code)+'" data-field="'+html(field)+'"'
                +' value="'+html(value)+'"'
                +(draft[code][field]===value?' checked':'')
                +'>'+html(value)+'</label>';
        }).join("");
    }

    function render()
    {
        var p=document.getElementById(popupID);
        if(!p) return;
        if(!draft) snapshot();
        var rows=EMU_system_modelCodes().map(function(code)
        {
            var config=_CFG_SYSCODE[code],selected=code===model;
            return '<tr class="'+(selected?'sysconfig-selected':'')+'">'
                +'<th scope="row" class="sysconfig-model">'
                +'<label class="sysconfig-model-label"><input type="radio"'
                +' name="sysconfig_model" value="'+html(code)+'"'
                +(selected?' checked':'')+'>'
                +'<span><strong>'+html(code)+'</strong><small>'+html(config.Model)+'</small></span></label></th>'
                +fields.map(function(field)
                {
                    return '<td>'+cell(code,field)+'</td>';
                }).join("")+'</tr>';
        }).join("");
        var oldScroller=p.querySelector(".sysconfig-table-scroller");
        var oldLeft=oldScroller ? oldScroller.scrollLeft : 0;
        var oldTop=oldScroller ? oldScroller.scrollTop : 0;
        p.innerHTML='<div class="sysconfig-header">'
           +'<strong id="sysconfig-title">SYSTEM CONFIGURATION</strong>'
           +'<button type="button" class="appbut sysconfig-close" data-action="close" title="Close system configuration">×</button>'
           +'</div>'
           +'<div class="sysconfig-intro">Select a model, then its available options. Changes take effect only after Apply.</div>'
           +'<div class="sysconfig-table-scroller" role="region" tabindex="0" aria-label="System option table (scroll horizontally)">'
           +'<table class="sysconfig-table"><thead><tr><th>System</th>'
           +fields.map(function(field){return '<th scope="col">'+html(headings[field])+'</th>';}).join("")
           +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
           +'<div class="sysconfig-footer">'
           +'<div class="sysconfig-note">A2P_RL uses the LIRON patch. A2P_RJ selects the J-Plus monitor and Katakana keycaps; virtual keys retain the standard Apple II ASCII encoder.</div>'
           +'<div class="sysconfig-notice" role="status" aria-live="polite">'+html(notice)+'</div>'
           +'<div class="sysconfig-actions">'
           +'<button type="button" class="appbut" data-action="close">Cancel</button>'
           +'<button type="button" class="appbut" data-action="apply">Apply &amp; cold boot</button>'
           +'</div></div>';
        var scroller=p.querySelector(".sysconfig-table-scroller");
        if(scroller) { scroller.scrollLeft=oldLeft; scroller.scrollTop=oldTop; }
        position();
    }

    function onChange(event)
    {
        if(!draft) return;
        var input=event.target;
        if(!input || input.type!=="radio") return;
        if(input.name==="sysconfig_model")
        {
            if(draft[input.value]) model=input.value;
        }
        else
        {
            var code=input.getAttribute("data-model");
            var field=input.getAttribute("data-field");
            if(!draft[code] || fields.indexOf(field)<0 ||
               EMU_system_options(code,field).indexOf(input.value)<0) return;
            draft[code][field]=input.value;
            model=code; // Choosing an option selects its owning system.
        }
        notice="";
        var name=input.name,value=input.value;
        render();
        // Preserve keyboard navigation while refreshing selected-row styles.
        var radios=document.getElementById(popupID).querySelectorAll('input[type="radio"]');
        for(var i=0;i<radios.length;i++)
            if(radios[i].name===name && radios[i].value===value)
            {
                radios[i].focus({preventScroll:true});
                break;
            }
    }

    function onClick(event)
    {
        var button=event.target && event.target.closest ? event.target.closest("[data-action]") : null;
        if(!button) return;
        var action=button.getAttribute("data-action");
        if(action==="close") close();
        if(action==="apply") apply();
    }

    function ensure()
    {
        var p=document.getElementById(popupID);
        if(p) return p;
        p=document.createElement("section");
        p.id=popupID;
        p.className="appbox sysconfig-popup";
        p.setAttribute("role","dialog");
        p.setAttribute("aria-modal","false");
        p.setAttribute("aria-labelledby","sysconfig-title");
        p.hidden=true;
        document.body.appendChild(p);
        p.addEventListener("change",onChange);
        p.addEventListener("click",onClick);
        if(typeof(oCOM)!=="undefined" && oCOM.POPUP && oCOM.POPUP.addScope)
            oCOM.POPUP.addScope(popupID,"tab1.1");
        return p;
    }

    function expanded(open)
    {
        var gear=document.getElementById("system_model_button");
        if(gear) gear.setAttribute("aria-expanded",open?"true":"false");
    }

    function open()
    {
        ensure();
        snapshot();
        render();
        oCOM.POPUP.on(popupID);
        expanded(true);
        position();
        return true;
    }

    function close()
    {
        if(document.getElementById(popupID)) oCOM.POPUP.off(popupID);
        draft=null;
        expanded(false);
        return true;
    }

    function toggle()
    {
        var p=ensure();
        var requestedOpen=oCOM.POPUP.states[popupID]===false;
        return requestedOpen ? close() : open();
    }

    function apply()
    {
        if(!draft || !draft[model]) return false;
        if(!EMU_system_selectConfiguration(model,draft[model]))
        {
            notice=EMU_system_configState.error || "Configuration was not applied.";
            render();
            return false;
        }
        close();
        return true;
    }

    if(typeof(window)!=="undefined" && window.addEventListener)
        window.addEventListener("resize",function()
        {
            var p=document.getElementById(popupID);
            if(p && !p.hidden) position();
        });

    return {toggle:toggle,open:open,close:close,render:render,position:position,
        apply:apply,selectModel:function(code){if(draft && draft[code]){model=code;render();}},
        getDraft:function(){return draft;},getSelectedModel:function(){return model;}};
})();
