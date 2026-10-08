# Port Script Console

Implement the design approved in conversation: a generic JavaScript console above
the existing Serial Pro terminal, a draggable 50/50 divider, Run/Stop/Clear/API
controls, and self-documenting peripheral facades. Includes stay in index.html.

SPSERIAL is the remote endpoint: write injects bytes into the UART; reads observe
Apple II transmissions without consuming the terminal, GPT or Web Serial streams.
Strings represent exact 8-bit characters; wider characters are rejected. Reads
return Uint8Array, and waitFor returns a byte string through the first match,
leaving trailing bytes queued. Read/flush affect only the facade's own buffer.
onReceive observes bytes without consuming them. Only one waitFor may be pending
per facade. Default timeout is 3000 ms, default buffer limit 65536 bytes; overflow
is reported rather than silently dropping data.

The facade is deliberately narrow and documented by SPSERIAL.API metadata. Each
console owns a facade subscription and releases it on slot/device replacement or
card removal. Normal popup hiding preserves the editor and facade, but stops a
running script. Source and split ratio persist per slot through localStorage.

User code executes in a terminable Web Worker. RPC exposes facade methods as
Promises (await write/read/available/flush/waitFor); onReceive is a worker callback
registration. Helpers: sleep(ms), log(...), hex(value,width=2). Run completion,
Stop and errors cancel pending waits and unregister callbacks. No emulator/card
object is sent to the worker. This is a local scripting tool, not a security
sandbox for untrusted code. Existing UART timing remains authoritative.

Verify raw bytes, split-chunk matching, timeout/abort/disposal/overflow, real UART
integration, simultaneous terminal observation, worker cancellation, generated
help, divider bounds, persistence and slot switching. Deliver a patch against
the inspected upstream commit plus usage documentation and tests.
