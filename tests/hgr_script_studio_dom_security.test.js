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
 assert.equal(blocks.length,2);
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
