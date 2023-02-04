## Emulator Architecture
 
### Modular setup

The emulator was purposefully made modular to allow developer communities to add or tweak hardware features.
The emulator object has a
- preset configurations (called SYTEMS, presented as a dropdown menu, each time a preset is selected, it overwrites the current configuration)
- eligible components (all include files are self-declaring, at boot time, all the elibible components are listed in oEMU and the existence of key methods is being checked, validated and marked as eligible, meaning they can be loaded into the current config)
- current configuration (a datastructure that describes all the components currently in use, before this config is loaded, it is checked against the eligible components)  Components can be turned on and off, but they can only be turned on, if they are marked as eligible component.


