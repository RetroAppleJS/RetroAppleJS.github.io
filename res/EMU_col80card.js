//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_col80card.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"col80card":new col80card()}}}
else oEMU.component.IO.col80card = new col80card();

function col80card()
{
    this.active = true; 
}