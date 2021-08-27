## TOOLS Explained

In the [tools folder](https://github.com/RetroAppleJS/AppleII-IDE/tree/main/tools), we keep a collection of helpers to simulate, better understand or automate processes supporting the development of the IDE.  Every tool is designed to run in the browser, just like the IDE, using HTML/CSS/JavaScript.

### DOCS_updater.html

In this project, we aim to have all the documentation available in markdown format, because it is easy to access, read and edit in GitHub.  As the IDE is a client-side application, security restrictions prevent these markdown files to be included into the main application.  Docs_updater.html was designed to read all the markdown documentation available online in this project, and compile a JavaScript include file that would provide a perfect copy of all the available documentation inside the IDE.

    ┌──────────┐          ┌─────────────┐        ┌───────────────┐
    │Readme.md │          │ Showdown.js │        │ Markdown.css  │
    └────┬─────┘          └──────┬──────┘        └──────┬────────┘
         │XmlHttpRequest()       │                      |
    ┌────┴────────┐     ┌────────┴───────┐       ┌──────┴───────┐     ┌────────────────────┐
    │Filter all   │     │Convert Markdown│       |  Preview     |     | Download JS file   |
    │Markdown docs├─────┤to HTML+adapters├───┐───┤  JS file     ├─────┤ _GENERATED_DOCS.js | 
    │in /docs dir │  ▲  │append JS queue │   │   |  rendering   |     | & save in /docs    |
    └─────────────┘  │  └────────────────┘   │   └──────────────┘     └────────────────────┘
                     │ loop until done       │
                     └───────────────────────┘
