from pathlib import Path

path = Path('index.html')
s = path.read_text()


def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    s = s.replace(old, new, 1)


css_anchor = '''              .ASM_paneInfo {
                color: rgba(0,0,0,0.70);
                font-family: arial, sans-serif;
                font-size: 11px;
                white-space: nowrap;
              }
'''
css_new = css_anchor + '''
              /* Explicit source dependencies loaded for S-C .IN directives. */
              .ASM_includeLabelWrap {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 2px 3px;
                width: 100%;
                min-width: 0;
                max-width: 100%;
                margin: 2px 0px;
              }

              .ASM_includeLabelWrap .appbut.label {
                float: none !important;
                display: inline-flex;
                align-items: center;
                gap: 3px;
                width: auto !important;
                min-width: 0;
                height: auto;
                min-height: 16px;
                line-height: 14px;
                margin: 0px;
                border-radius: 3px;
                background: rgba(128,128,128,0.08);
                border: 1px solid black;
                color: #000000;
                font-family: arial;
                font-size: 11px;
                padding: 0px 2px;
                box-sizing: border-box;
                white-space: nowrap;
                cursor: default;
              }

              .ASM_includeLabelWrap .ASM_includeRemove {
                float: none !important;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 14px;
                min-width: 14px;
                height: 14px;
                min-height: 14px;
                line-height: 12px;
                margin: 0px;
                padding: 0px;
                cursor: pointer;
              }
'''
replace_once(css_anchor, css_new, 'include chip CSS anchor')

html_anchor = '''                    <div class=appbut style="color:black">
                      load assembler code<input id="ASM_fileInput" style="display:inline-block" type="file" accept=".S,.s,.ASM,.asm,.INC,.inc,.txt,text/plain">
                    </div>
'''
html_new = '''                    <div class=appbut style="color:black">
                      load include files<input id="ASM_includeFileInput" style="display:inline-block" type="file" multiple accept=".INC,.inc,.S,.s,.ASM,.asm,.txt,.src,.a65,.mac,text/plain">
                    </div>
                    <div id="ASM_includeLabelWrap" class="ASM_includeLabelWrap"></div>
''' + html_anchor
replace_once(html_anchor, html_new, 'include file chooser anchor')

state_anchor = '''            var ASM_currentFileName = "sample.S";
            var ASM_currentJsonText = "";
'''
include_block = '''            var ASM_currentFileName = "sample.S";
            var ASM_includeFiles = [];
            var ASM_nextIncludeFileId = 1;

            /* ASM INCLUDE FILES BEGIN */
            function ASM_includeNameKey(name)
            {
              return String(name || "").trim().toUpperCase();
            }

            function ASM_findIncludeIndexByName(name)
            {
              var key = ASM_includeNameKey(name);
              for(var i=0;i<ASM_includeFiles.length;i++)
                if(ASM_includeNameKey(ASM_includeFiles[i].name) === key) return i;
              return -1;
            }

            function ASM_buildIncludeMap()
            {
              var includes = {};
              for(var i=0;i<ASM_includeFiles.length;i++)
              {
                var file = ASM_includeFiles[i];
                includes[file.name] = {
                  source:String(file.source == null ? "" : file.source),
                  sourceName:file.sourceName || file.name
                };
              }
              return includes;
            }

            function ASM_renderIncludeLabels()
            {
              var wrap = ASM_el("ASM_includeLabelWrap");
              if(!wrap) return;
              wrap.replaceChildren();

              for(var i=0;i<ASM_includeFiles.length;i++)
              {
                var file = ASM_includeFiles[i];
                var chip = document.createElement("div");
                chip.className = "appbut label";
                chip.title = file.sourceName || file.name;
                chip.appendChild(document.createTextNode(file.name + " "));

                var remove = document.createElement("div");
                remove.className = "appbut skinny ASM_includeRemove";
                remove.title = "Remove include file";
                remove.textContent = "x";
                remove.setAttribute("data-include-id",file.id);
                remove.onclick = function(ev)
                {
                  ev.stopPropagation();
                  ASM_removeIncludeFile(this.getAttribute("data-include-id"));
                };

                chip.appendChild(remove);
                wrap.appendChild(chip);
              }
            }

            function ASM_addIncludeText(name,text,sourceName)
            {
              name = String(name || "include.INC").trim() || "include.INC";
              var index = ASM_findIncludeIndexByName(name);
              var replaced = index >= 0;

              if(replaced)
              {
                ASM_includeFiles[index].name = name;
                ASM_includeFiles[index].source = String(text == null ? "" : text);
                ASM_includeFiles[index].sourceName = sourceName || name;
              }
              else
              {
                ASM_includeFiles.push({
                  id:"asminc_" + (ASM_nextIncludeFileId++),
                  name:name,
                  sourceName:sourceName || name,
                  source:String(text == null ? "" : text)
                });
              }

              ASM_renderIncludeLabels();
              return {name:name,replaced:replaced};
            }

            function ASM_removeIncludeFile(id)
            {
              id = String(id || "");
              var removed = null;
              ASM_includeFiles = ASM_includeFiles.filter(function(file)
              {
                if(String(file.id) === id) { removed = file; return false; }
                return true;
              });

              if(!removed) return false;

              ASM_renderIncludeLabels();
              ASM_clearOutputs(
                "Removed include " + removed.name + ". Reassemble to refresh the listing and byte code.",
                "warn"
              );
              return true;
            }

            async function ASM_loadIncludeFiles(fileList)
            {
              var files = Array.prototype.slice.call(fileList || []);
              if(!files.length) return {loaded:0,replaced:0};

              var loaded = 0;
              var replaced = 0;

              for(var i=0;i<files.length;i++)
              {
                var file = files[i];
                var result = ASM_addIncludeText(
                  file.name || "include.INC",
                  await file.text(),
                  file.name || "include.INC"
                );
                if(result.replaced) replaced++; else loaded++;
              }

              var message = "Loaded " + loaded + " include file" + (loaded === 1 ? "" : "s");
              if(replaced) message += "; replaced " + replaced + " existing include" + (replaced === 1 ? "" : "s");
              message += ". Reassemble to refresh the listing and byte code.";
              ASM_clearOutputs(message,"ok");

              return {loaded:loaded,replaced:replaced};
            }
            /* ASM INCLUDE FILES END */

            var ASM_currentJsonText = "";
'''
replace_once(state_anchor, include_block, 'include state anchor')

asm_anchor = '''                window.oASM = new ASM({
                  listingColumns:listingColumnsInput ? listingColumnsInput.value : undefined,
                  dQuoteLegacy:ASM_dQuoteLegacyValue()
                });
'''
asm_new = '''                window.oASM = new ASM({
                  listingColumns:listingColumnsInput ? listingColumnsInput.value : undefined,
                  dQuoteLegacy:ASM_dQuoteLegacyValue(),
                  sourceName:ASM_currentFileName,
                  includes:ASM_buildIncludeMap()
                });
'''
replace_once(asm_anchor, asm_new, 'ASM constructor anchor')

replace_once(
    '                var rows = window.oASM.tokenise(sourcePane.value);\n',
    '                var rows = window.oASM.tokenise(sourcePane.value,ASM_currentFileName);\n',
    'tokenise sourceName anchor'
)

bind_anchor = '''            function ASM_bindEvents()
            {
              var fileInput = ASM_el("ASM_fileInput");
              var assembleButton = ASM_el("ASM_assembleButton");
'''
bind_new = '''            function ASM_bindEvents()
            {
              var fileInput = ASM_el("ASM_fileInput");
              var includeFileInput = ASM_el("ASM_includeFileInput");
              var assembleButton = ASM_el("ASM_assembleButton");
'''
replace_once(bind_anchor, bind_new, 'include input binding anchor')

event_anchor = '''              if(fileInput) fileInput.addEventListener("change",function(){ ASM_loadFile(fileInput.files && fileInput.files[0]); });
              if(assembleButton) assembleButton.addEventListener("click",function(ev){ ev.preventDefault(); ASM_assembleCurrentSource(); });
'''
event_new = '''              if(fileInput) fileInput.addEventListener("change",function(){ ASM_loadFile(fileInput.files && fileInput.files[0]); });
              if(includeFileInput) includeFileInput.addEventListener("change",async function()
              {
                try
                {
                  await ASM_loadIncludeFiles(includeFileInput.files);
                }
                catch(err)
                {
                  ASM_setStatus("Include load failed: " + (err && err.message ? err.message : err),"bad");
                }
                finally
                {
                  includeFileInput.value = "";
                }
              });
              if(assembleButton) assembleButton.addEventListener("click",function(ev){ ev.preventDefault(); ASM_assembleCurrentSource(); });
'''
replace_once(event_anchor, event_new, 'include input change event anchor')

path.write_text(s)
print('patched index.html')
