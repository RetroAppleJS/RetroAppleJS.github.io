## Emulator Architecture
 
### Modular setup

The emulator was made modular for extensibility.  Adding or tweaking virtual hardware features should be achieved with ease.
Therefore, we have additional code to detect, classify, test, initialise and keep all the virtual hardware in check, also known as the kernal boot.

The kernal boot process 
- **inventorise eligible components**  All self-declared include files are classified and validated after which they are listed as elibible emulator components.  Only eligible components listed as such can activated into the current configuration, even if the current is loaded from a preset configuration, non-eligible components simply will never run.
- **initialise current configuration** (a datastructure that describes all the components currently in use, before this config is loaded, it is checked against the eligible components)  Components can be turned on and off, but they can only be turned on, if they are marked as eligible component.
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
