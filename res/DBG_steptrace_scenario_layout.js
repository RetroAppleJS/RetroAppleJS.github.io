(function(g){
'use strict';
var D=g.document,resizeBound=false,wrapped=false,tracePositioned=false;
function E(id){return D&&D.getElementById?D.getElementById(id):null}
function referenceToolboxes()
{
  var tab=E('tab1.1'),boxes=[];
  if(!tab||!tab.children)return boxes;
  for(var i=0;i<tab.children.length;i++)
  {
    var n=tab.children[i];
    if(n&&n.classList&&n.classList.contains('toolbox')&&n.id!=='feature_box')boxes.push(n);
  }
  return boxes;
}
function toolboxReferenceGap()
{
  var boxes=referenceToolboxes();
  if(boxes.length<2||!boxes[0].getBoundingClientRect||!boxes[1].getBoundingClientRect)return 3;
  var gap=Math.round(boxes[1].getBoundingClientRect().left-boxes[0].getBoundingClientRect().right);
  return gap>=1&&gap<=16?gap:3;
}
function normalizeTracePosition(gap)
{
  var boxes=referenceToolboxes(),dbg=E('cpuDbg_popup');
  if(tracePositioned||boxes.length<2||!dbg||!dbg.getBoundingClientRect)return;
  var slot=boxes[1].getBoundingClientRect(),r=dbg.getBoundingClientRect();
  if(!slot.width||!r.width)return;
  var delta=Math.round(slot.right+gap-r.left);
  if(Math.abs(delta)<=24)
  {
    dbg.style.position='relative';
    dbg.style.left=delta+'px';
    tracePositioned=true;
  }
}
function normalizeTraceWidth(gap)
{
  var dbg=E('cpuDbg_popup');
  if(!dbg||!dbg.getBoundingClientRect)return 0;
  var delta=Math.max(0,8-gap);
  // Do not cache a zero width while SETTINGS/STEP TRACE are hidden at
  // startup; the companion layout may be measured before Debugger opens.
  var measured=dbg.getBoundingClientRect().width;
  if(dbg._stepTraceScenarioBaseWidth==null ||
     (dbg._stepTraceScenarioBaseWidth===0 && measured>0))
    dbg._stepTraceScenarioBaseWidth=measured;
  if(dbg._stepTraceScenarioBaseWidth>0)
  {
    dbg.style.boxSizing='border-box';
    dbg.style.width=Math.round(dbg._stepTraceScenarioBaseWidth+delta)+'px';
  }
  return delta;
}
/*
 * Both companion windows use STEP TRACE as their layout reference, even
 * while SETTINGS is closed. Measuring the TOOLS pasteboard instead produces
 * unrelated coordinates and does not survive opening Script first.
 *
 * While measuring a closed SETTINGS panel, expose its layout invisibly and
 * synchronously restore both original hidden states. No popup visibility
 * preferences or running debugger state are changed.
 */
function companionPlacement()
{
  var settings=E('tab1.1'),dbg=E('cpuDbg_popup');
  if(!settings||!dbg||!dbg.getBoundingClientRect)return null;

  var settingsHidden=!!settings.hidden,dbgHidden=!!dbg.hidden;
  var previousVisibility=settings.style.visibility;
  try
  {
    if(settingsHidden)
    {
      settings.style.visibility='hidden';
      settings.hidden=false;
    }
    if(dbgHidden)dbg.hidden=false;

    var gap=toolboxReferenceGap();
    normalizeTracePosition(gap);
    normalizeTraceWidth(gap);

    var r=dbg.getBoundingClientRect();
    if(!r.width||!r.height)return null;
    var vw=g.innerWidth||(D.documentElement&&D.documentElement.clientWidth)||1024;
    var preferred=460;
    var rightRoom=Math.max(0,vw-gap-r.right),pw=Math.min(preferred,rightRoom);
    var left;
    if(pw>=320)left=r.right+gap;
    else
    {
      pw=Math.min(preferred,Math.max(320,r.left-gap*2));
      left=Math.max(gap,r.left-pw-gap);
    }
    // Both windows are position:absolute under document.body.
    var sx=g.pageXOffset||0,sy=g.pageYOffset||0;
    return {
      left:Math.round(left+sx),
      top:Math.round(r.top+sy),
      width:Math.round(pw),
      maxWidth:'calc(100vw - '+(gap*2)+'px)'
    };
  }
  finally
  {
    if(dbgHidden)dbg.hidden=true;
    if(settingsHidden)
    {
      settings.hidden=true;
      settings.style.visibility=previousVisibility;
    }
  }
}
function positionCompanion(p)
{
  if(!p||p.hidden)return false;
  var placement=companionPlacement();
  if(!placement)return false;
  p.style.width=placement.width+'px';
  p.style.maxWidth=placement.maxWidth;
  p.style.left=placement.left+'px';
  p.style.top=placement.top+'px';
  return true;
}
function positionPopup()
{
  return positionCompanion(E('DBG_steptraceScenarioPopup'));
}
// The Pasteboard Script popup reuses the same exact geometry function.
g.EMU_COMPANION_LAYOUT={placement:companionPlacement,position:positionCompanion};
function scopePopup()
{
  var p=E('DBG_steptraceScenarioPopup');
  if(!p||!g.oCOM||!oCOM.POPUP||typeof oCOM.POPUP.addScope!=='function')return false;
  oCOM.POPUP.addScope("DBG_steptraceScenarioPopup","tab1.1");
  return true;
}
function tabActive()
{
  var tab=E('tab1.1');
  return !!(tab&&!tab.hidden);
}
function wrapUi()
{
  var S=g.DBG_STEPTRACE_SCENARIO||g.STB;
  if(wrapped||!S||!S.ui)return false;
  wrapped=true;
  var open=S.ui.open,close=S.ui.close;
  S.ui.open=function()
  {
    var ok=open.apply(S.ui,arguments);
    scopePopup();
    if(g.oCOM&&oCOM.POPUP&&typeof oCOM.POPUP.set_state==='function')
      oCOM.POPUP.set_state("DBG_steptraceScenarioPopup",false);
    positionPopup();
    return ok;
  };
  S.ui.close=function()
  {
    if(!tabActive()&&g.oCOM&&oCOM.POPUP&&typeof oCOM.POPUP.syncScopes==='function')
    {
      oCOM.POPUP.syncScopes();
      return true;
    }
    var ok=close.apply(S.ui,arguments);
    if(g.oCOM&&oCOM.POPUP&&typeof oCOM.POPUP.set_state==='function')
      oCOM.POPUP.set_state("DBG_steptraceScenarioPopup",true);
    return ok;
  };
  S.ui.position=positionPopup;
  return true;
}
function apply()
{
  var S=g.DBG_STEPTRACE_SCENARIO||g.STB;
  if(S&&S.ui&&typeof S.ui.init==='function')S.ui.init();
  scopePopup();
  wrapUi();
  var gap=toolboxReferenceGap();
  normalizeTracePosition(gap);
  normalizeTraceWidth(gap);
  positionPopup();
}
function init()
{
  apply();
  if(!resizeBound&&g.addEventListener){g.addEventListener('resize',apply);resizeBound=true}
}
if(g.oCOM&&g.oCOM.addToEventStack)g.oCOM.addToEventStack('onload',init);
else if(g.addEventListener)g.addEventListener('load',init);
})(window);
