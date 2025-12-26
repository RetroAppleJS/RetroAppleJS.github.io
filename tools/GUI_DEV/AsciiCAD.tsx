import React from "react";

export default function App() {
  // Use the served page (GitHub Pages or local http server), NOT file://
  const URL = "https://retroapplejs.github.io/tools/GUI_DEV/AsciiCAD.html";

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => window.open(URL, "_blank", "noopener,noreferrer")}>Open in new tab</button>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, opacity: 0.75 }}>
          Loaded from GitHub Pages. For local edits, serve AsciiCAD.html over http://localhost.
        </span>
      </div>

      <iframe
        title="AsciiCAD"
        src={URL}
        style={{ flex: 1, border: 0, width: "100%" }}
        sandbox="allow-scripts allow-downloads allow-pointer-lock allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
