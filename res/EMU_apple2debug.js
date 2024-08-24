//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

function Apple2Debug()
{
    this.cycle = function(obj)
    {
        var el = document.getElementById( oEMU.component.CPU.Apple2Debug.disp_id );
        el.innerHTML = obj.cpu.save()+"<br>"
        //console.log( obj.cpu.save() );
    }

    this.play = function(bPlay)
    {
        if(bPlay)
        {
            _o._EMU_Updates_s = _o.EMU_Updates_s;               // push previous value
            _o._EMU_IntervalTime_ms = _o.EMU_IntervalTime_ms;   // push previous value

            _o.EMU_Updates_s = 1;
            _o._EMU_IntervalTime_ms = 1000;
            oEMUI.cpuSpd(1 / _o.CPU_ClocksTicks_s);
        }
        else
        {
            _o.EMU_Updates_s = _o._EMU_Updates_s;               // pop previous value
            _o.EMU_IntervalTime_ms = _o._EMU_IntervalTime_ms;   // pop previous value

            delete _o._EMU_Updates_s;
            delete _o._EMU_IntervalTime_ms;
            oEMUI.cpuSpd(0);
        }
    }
}