'use strict';
const fs=require('node:fs');
const file='tools/GUI_DEV/apple2-system-composer.html';
let source=fs.readFileSync(file,'utf8');
const from=`            <div class="field-grid">
              <div class="field"><label for="slotNInput">SlotN</label><input id="slotNInput" type="number" min="0" max="8" step="1"></div>
              <div class="field"><label for="runtimeAddressInput">Runtime address</label><input id="runtimeAddressInput" class="runtime-address" type="text" readonly></div>
            </div>
`;
const to=`                <div class="field-grid">
                  <div class="field"><label for="slotNInput">SlotN</label><input id="slotNInput" type="number" min="0" max="8" step="1"></div>
                  <div class="field"><label for="runtimeAddressInput">Runtime address</label><input id="runtimeAddressInput" class="runtime-address" type="text" readonly></div>
                </div>
`;
if(!source.includes(from)) throw new Error('Could not normalize metadata field-grid indentation');
fs.writeFileSync(file,source.replace(from,to));
console.log('Normalized Composer metadata field-grid indentation for Task 1 patch');
