//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_mockingboard.js


if(oEMU===undefined) var oEMU = {"component":{"IO":{"mockingboard":new mockingboard()}}}
else oEMU.component.IO.mockingboard= new mockingboard();

function mockingboard()
{
    //console.log("oEMU="+typeof(oEMU))
    this.id     = {"PCODE":"MOCK", "icon":"fa fa-assistive-listening-systems"}
    this.state = {"active":true};
        
    this.init = function()
    {
        //oEMU.component.IO.DRIVER.mount("MOCK",3,this.mockingboard,false);
    }

    this.read = function(addr)
    {

    }

    this.write = function(addr)
    {

    }
}