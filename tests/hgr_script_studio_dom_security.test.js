// Regression tests for CodeQL js/xss-through-dom in HGR Script Studio.
// Run: node --test tests/hgr_script_studio_dom_security.test.js
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"../tools/HGR_SCRIPT_STUDIO.html"),"utf8");

class Node {
 constructor(tag="#fragment",value=""){
  this.tag=tag;this._text=tag==="#text"?String(value):null;
  this.children=[];this.className="";
 }
 append(...children){
  for(const item of children)this.children.push(typeof item==="string"?new Node("#text",item):item);
 }
 replaceChildren(...children){this.children=[];this.append(...children);}
 get firstChild(){return this.children[0]||null;}
 get textContent(){return this.tag==="#text"?this._text:this.children.map(x=>x.textContent).join("");}
 set textContent(value){
  if(this.tag==="#text")this._text=String(value);
  else this.children=[new Node("#text",String(value))];
 }
 set innerHTML(value){throw new Error("Unsafe HTML sink used: "+value);}
 get innerHTML(){throw new Error("Unexpected innerHTML getter");}
}
const document={
 createElement:tag=>new Node(tag),
 createTextNode:text=>new Node("#text",text),
 createDocumentFragment:()=>new Node()
};
function collectTags(root){
 const result=[];
 (function visit(node){
  if(node.tag!=="#fragment"&&node.tag!=="#text")result.push(node.tag);
  for(const child of node.children)visit(child);
 })(root);
 return result;
}
function sourceBetween(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"Missing source region: "+start);
 return html.slice(a,b);
}

test("inline JavaScript is syntactically valid",()=>{
 const blocks=[...html.matchAll(/<script(?![^>]*type="text\/plain")[^>]*>([\s\S]*?)<\/script>/g)].filter(match=>!/\bsrc\s*=/.test(match[0].split(">")[0]));
 assert.ok(blocks.length>=2,'Expected Studio and renderer alias scripts');
 for(const b of blocks)new vm.Script(b[1]);
});
test("no HTML-reinterpretation sinks remain",()=>{
 assert.doesNotMatch(html,/\.\s*(?:innerHTML|outerHTML)\s*=/);
 assert.doesNotMatch(html,/insertAdjacentHTML\s*\(/);
 assert.doesNotMatch(html,/document\.write\s*\(/);
});
test("syntax highlighting renders malicious-looking JavaScript as inert text",()=>{
 const src=sourceBetween("function highlightJS(source){","\nfunction updateCodeView()");
 const context={document};
 vm.createContext(context);
 vm.runInContext(src,context);
 const attack='const x = "<img src=x onerror=alert(1)>";\n// <svg onload=alert(1)>';
 const tree=context.highlightJS(attack);
 assert.equal(tree.textContent,attack+"\n");
 assert.ok(collectTags(tree).includes("span"),"Syntax highlighting was lost");
 assert.ok(tree.children.some(x=>x.className==="tok-keyword"));
 assert.ok(tree.children.some(x=>x.className==="tok-string"));
 assert.ok(tree.children.some(x=>x.className==="tok-comment"));
 assert.ok(collectTags(tree).every(x=>x==="span"),"Markup from source was interpreted as an element");
});
test("Markdown docs render formatting without parsing embedded HTML",()=>{
 const markdown=[
  "# API <img src=x onerror=alert(1)>",
  "",
  "Hello **bold** and *italic* with "+String.fromCharCode(96)+"inline code"+String.fromCharCode(96)+".",
  "",
  "| API | Example |",
  "| --- | --- |",
  "| <script> | safe text |",
  "",
  "- <svg onload=alert(1)>",
  "> <img src=x>",
  "",
  "## Second section",
  "A paragraph.",
  "",
  String.fromCharCode(96,96,96)+"js",
  "const x='<img src=x onerror=alert(1)>'",
  String.fromCharCode(96,96,96)
 ].join("\n");
 const nodes={
  apiMarkdown:new Node("script"),
  docsSearch:new Node("input"),
  docsView:new Node("div")
 };
 nodes.apiMarkdown.textContent=markdown;
 nodes.docsSearch.value="";
 const context={document,el:id=>nodes[id]};
 const src=sourceBetween("function appendMarkdownInline(parent,source){","\nel('docsSearch').addEventListener");
 vm.createContext(context);
 vm.runInContext(src,context);
 context.renderDocs();
 const view=nodes.docsView,tags=collectTags(view);
 assert.ok(tags.includes("h1")&&tags.includes("h2"));
 assert.ok(tags.includes("strong")&&tags.includes("em")&&tags.includes("code"));
 assert.ok(tags.includes("table")&&tags.includes("td")&&tags.includes("ul"));
 assert.ok(tags.includes("blockquote")&&tags.includes("pre"));
 assert.ok(!tags.includes("img")&&!tags.includes("svg")&&!tags.includes("script"));
 assert.ok(view.textContent.includes("<img src=x onerror=alert(1)>"));
 assert.ok(view.textContent.includes("<script>"));
 assert.ok(view.textContent.includes("inline code"));
 nodes.docsSearch.value="not-a-section";
 context.renderDocs();
 assert.ok(nodes.docsView.textContent.includes("No matching sections."));
 assert.ok(collectTags(nodes.docsView).every(t=>t!=="img"&&t!=="svg"&&t!=="script"));
});


test("HGR download creates only a trusted blob URL and treats the filename as data",()=>{
 const src=sourceBetween("function downloadBlob(","function exportHGR()");
 const calls=[],timers=[],links=[];
 class TestBlob {
  constructor(parts,options){this.parts=parts;this.type=options.type;}
 }
 const context={
  Blob:TestBlob,
  URL:{
   createObjectURL(blob){calls.push(["blob",blob]);return "blob:https://example.test/generated-123";},
   revokeObjectURL(url){calls.push(["revoke",url]);}
  },
  document:{
   createElement(tag){
    assert.equal(tag,"a");
    const attrs=new Map();
    const link={
     attrs,
     setAttribute(k,v){attrs.set(k,v);calls.push(["attribute",k,v]);},
     click(){calls.push(["click"]);},
     remove(){calls.push(["remove"]);}
    };
    links.push(link);return link;
   },
   body:{appendChild(link){calls.push(["append",link]);}}
  },
  setTimeout(fn,delay){timers.push({fn,delay});}
 };
 vm.createContext(context);vm.runInContext(src,context);
 context.downloadBlob("HGR content","../<script>.js","text/javascript;charset=utf-8");
 assert.equal(links.length,1);
 const attrs=links[0].attrs;
 assert.equal(attrs.get("href"),"blob:https://example.test/generated-123");
 assert.equal(attrs.get("download"),"..__script_.js");
 assert.equal(attrs.get("rel"),"noopener noreferrer");
 assert.equal(calls.filter(([kind])=>kind==="click").length,1);
 assert.ok(calls.findIndex(([kind])=>kind==="append")<calls.findIndex(([kind])=>kind==="click"));
 assert.ok(calls.findIndex(([kind])=>kind==="click")<calls.findIndex(([kind])=>kind==="remove"));
 assert.equal(timers.length,1);
 assert.equal(timers[0].delay,5000);
 timers[0].fn();
 assert.deepEqual(calls.at(-1),["revoke","blob:https://example.test/generated-123"]);
 assert.equal(calls[0][1].type,"text/javascript;charset=utf-8");
 assert.doesNotMatch(src,/\.innerHTML\s*=/);
 assert.doesNotMatch(src,/\.href\s*=/);
});

test("HGR export rejects unexpected URL schemes and empty filenames before clicking",()=>{
 const src=sourceBetween("function downloadBlob(","function exportHGR()");
 const calls=[];
 const context={
  Blob:class TestBlob {constructor(parts,opts){this.parts=parts;this.type=opts.type;}},
  URL:{
   createObjectURL(){return "javascript:alert(1)";},
   revokeObjectURL(u){calls.push("revoke:"+u);}
  },
  document:{createElement(){calls.push("createAnchor");return {};}},
  setTimeout(){calls.push("timer");}
 };
 vm.createContext(context);vm.runInContext(src,context);
 assert.throws(()=>context.downloadBlob("data","test.hgr"),/Expected a browser-generated blob URL/);
 assert.deepEqual(calls,["revoke:javascript:alert(1)"]);
 assert.throws(()=>context.downloadBlob("data",""),/Download filename is empty/);
 assert.deepEqual(calls,["revoke:javascript:alert(1)"]);
});
