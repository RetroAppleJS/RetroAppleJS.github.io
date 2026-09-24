/*
 * DBG_testbench.js
 *
 * Compatibility loader.  The original isolated TEST BENCH implementation is
 * preserved byte-for-byte as DBG_testbench_legacy.js.  The live STEP TRACE
 * scenario bench is layered beside it without changing index.html.
 */
(function(global){
  "use strict";

  var scripts = [
    "res/DBG_testbench_legacy.js",
    "res/DBG_steptrace_scenario.js"
  ];

  if(global.document && global.document.readyState === "loading" &&
     typeof global.document.write === "function")
  {
    for(var i=0;i<scripts.length;i++)
      global.document.write('<script type="text/javascript" src="' + scripts[i] + '"></script>');
    return;
  }

  function loadAt(index)
  {
    if(index >= scripts.length || !global.document) return;
    var node = global.document.createElement("script");
    node.type = "text/javascript";
    node.src = scripts[index];
    node.async = false;
    node.onload = function(){ loadAt(index+1); };
    (global.document.head || global.document.documentElement || global.document.body).appendChild(node);
  }

  loadAt(0);
})(window);
