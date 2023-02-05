## Emulator Architecture
 
### Modular setup

The emulator was purposefully made modular to allow developer communities to add or tweak hardware features.
The emulator object has
- **eligible components**  During kernel boot process, all self-declared include files are listed and validated after which they are categorised as elibible emulator components.  Only eligible components listed as such can activated into the current configuration, even if the current is loaded from a preset configuration, non-eligible components will never run.
- **current configuration** (a datastructure that describes all the components currently in use, before this config is loaded, it is checked against the eligible components)  Components can be turned on and off, but they can only be turned on, if they are marked as eligible component.
- **preset configurations** called SYTEMS, presented as a dropdown menu. Each time a preset is selected, it overwrites the current configuration

      <div style=width:800px>
          index.html
          ┌────────────────────────────────────────┐      ▲                  ▲
          │ - list eligible components in oEMU     │      │                  │
          │ - find key method endpoints (e.g. init)│      │                  │
          │ - validate eligible components in oEMU │      │                  │
          │                                        │      │                  │
          ├────────────────────────────────────────┤     ─┘                  │
        
          └────────────────────────────────────┘  ─┘                         ▼
  

          </div>
