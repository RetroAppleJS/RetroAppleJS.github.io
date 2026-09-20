from pathlib import Path

unidisk_path=Path('res/EMU_DEVICE_UNIDISK35.js')
s=unidisk_path.read_text()

needle='''    this.id = {\n         "DCODE":"UNIDISK35"\n        ,"hostPCODE":"LIRON"\n        ,"icon":"fa fa-hdd"\n        ,"description":"Apple UniDisk 3.5"\n    };\n'''
replacement=needle+'''\n    this.ports = {\n        "smartport":{\n             "label":"SmartPort"\n            ,"kind":"bus"\n            ,"direction":"bidirectional"\n            ,"protocol":"SmartPort"\n            ,"unit":null\n            ,"visibility":"public"\n        }\n    };\n'''
if needle not in s:
    raise SystemExit('UniDisk id block not found')
s=s.replace(needle,replacement,1)

needle='''    this.setUnit = function(unit)\n    {\n        unit = Number(unit);\n        if(!Number.isInteger(unit) || unit<0 || unit>8)\n            throw new RangeError("SmartPort unit must be an integer from 0 through 8");\n        state.unit = unit;\n        return state.unit;\n    };\n'''
replacement='''    this.setUnit = function(unit)\n    {\n        unit = Number(unit);\n        if(!Number.isInteger(unit) || unit<0 || unit>8)\n            throw new RangeError("SmartPort unit must be an integer from 0 through 8");\n        state.unit = unit;\n        this.ports.smartport.unit = unit>0 ? unit : null;\n        return state.unit;\n    };\n'''
if needle not in s:
    raise SystemExit('UniDisk setUnit block not found')
s=s.replace(needle,replacement,1)
unidisk_path.write_text(s)

io_path=Path('res/EMU_apple2io.js')
s=io_path.read_text()
needle='''    function slotDevicePortLabel(name,port)\n    {\n        var parts = [String("<b>"+name+"</b>")];\n\n        if(port && port.direction)\n            parts.push(String(port.direction.toUpperCase()));\n\n        if(port && port.mime)\n        {\n            var mime = Array.isArray(port.mime)\n                ? port.mime.join(", ")\n                : String(port.mime);\n            if(mime) parts.push(mime);\n        }\n\n       return parts.join("·");\n    }\n'''
replacement='''    function slotDevicePortLabel(name,port)\n    {\n        port = port || {};\n\n        /*\n         * Structured bus/device ports provide their own human-facing label and\n         * runtime instance selector.  Keep transport details such as protocol,\n         * direction and MIME metadata available in JSON without crowding the\n         * compact Device-table chip.\n         */\n        if(port.label!==undefined || port.unit!==undefined)\n        {\n            var label = port.label===undefined || port.label===null || String(port.label)===""\n                ? String(name)\n                : String(port.label);\n            var structured = [label];\n            if(port.unit!==undefined && port.unit!==null && port.unit!=="")\n                structured.push("Unit "+String(port.unit));\n            return structured.join(" · ");\n        }\n\n        /* Legacy port metadata keeps its existing direction/MIME rendering. */\n        var parts = [String("<b>"+name+"</b>")];\n\n        if(port.direction)\n            parts.push(String(port.direction.toUpperCase()));\n\n        if(port.mime)\n        {\n            var mime = Array.isArray(port.mime)\n                ? port.mime.join(", ")\n                : String(port.mime);\n            if(mime) parts.push(mime);\n        }\n\n       return parts.join("·");\n    }\n'''
if needle not in s:
    raise SystemExit('slotDevicePortLabel block not found')
s=s.replace(needle,replacement,1)
io_path.write_text(s)
