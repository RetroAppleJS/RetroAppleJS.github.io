'use strict';
const fs=require('node:fs');
const path='res/EMU_DEVICE_HD20.js';
let src=fs.readFileSync(path,'utf8');

function replaceOnce(oldText,newText,label)
{
    const first=src.indexOf(oldText);
    if(first<0) throw new Error(label+': target not found');
    if(src.indexOf(oldText,first+oldText.length)>=0)
        throw new Error(label+': target is not unique');
    src=src.slice(0,first)+newText+src.slice(first+oldText.length);
}

replaceOnce(
`    const DEVICE_NAME = String(options.name===undefined ? "HARD DISK 20" : options.name).slice(0,16);\n    const SURFACE_COLUMNS = 16;\n    const SURFACE_ROWS = 64;\n    const SURFACE_BLOCKS_PER_PANEL = SURFACE_COLUMNS * SURFACE_ROWS;\n    const SURFACE_PANELS_PER_PAGE = 2;\n    const SURFACE_BLOCKS_PER_PAGE = SURFACE_BLOCKS_PER_PANEL * SURFACE_PANELS_PER_PAGE;\n    const SURFACE_PAGE_COUNT = BLOCK_COUNT / SURFACE_BLOCKS_PER_PAGE;`,
`    const DEVICE_NAME = String(options.name===undefined ? "HARD DISK 20" : options.name).slice(0,16);`,
'duplicate surface constants');

replaceOnce(
`    function surfacePosition(blockNumber)\n    {\n        blockNumber=Number(blockNumber);\n        if(!Number.isInteger(blockNumber) || blockNumber<0 || blockNumber>=BLOCK_COUNT) return null;\n        var page=Math.floor(blockNumber/SURFACE_BLOCKS_PER_PAGE);\n        var withinPage=blockNumber%SURFACE_BLOCKS_PER_PAGE;\n        var panel=Math.floor(withinPage/SURFACE_BLOCKS_PER_PANEL);\n        var withinPanel=withinPage%SURFACE_BLOCKS_PER_PANEL;\n        return {\n             "block":blockNumber\n            ,"page":page\n            ,"panel":panel\n            ,"row":Math.floor(withinPanel/SURFACE_COLUMNS)\n            ,"column":withinPanel%SURFACE_COLUMNS\n        };\n    }\n\n`,
'',
'duplicate surface-position helper');

replaceOnce(
`    this.getSurfaceMapGeometry = function()\n    {\n        return {\n             "kind":"logical-blocks"\n            ,"cellWidth":10\n            ,"cellHeight":10\n            ,"bytesPerBlock":BLOCK_SIZE\n            ,"totalBlocks":BLOCK_COUNT\n            ,"columnsPerPanel":SURFACE_COLUMNS\n            ,"rowsPerPanel":SURFACE_ROWS\n            ,"blocksPerPanel":SURFACE_BLOCKS_PER_PANEL\n            ,"panelsPerPage":SURFACE_PANELS_PER_PAGE\n            ,"blocksPerPage":SURFACE_BLOCKS_PER_PAGE\n            ,"bytesPerPage":SURFACE_BLOCKS_PER_PAGE*BLOCK_SIZE\n            ,"pageCount":SURFACE_PAGE_COUNT\n        };\n    };\n    this.getSurfaceMapPosition = function() { return surfacePosition(state.lastBlock); };\n`,
'',
'duplicate surface-map API');

fs.writeFileSync(path,src);
console.log('Removed duplicate HD20 surface-map merge fragments');
