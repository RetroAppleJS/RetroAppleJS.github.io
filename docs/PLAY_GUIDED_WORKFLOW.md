# Guided UI interaction model and contract boundaries

| Stage | UI input/action | Source of truth | Output |
|---|---|---|---|
| 1 Source | `.sid` or Complete Report | Existing PLAY parser / source report importer | PSID identity + evidence collection |
| 1 AI session | API key + model | Single page session | Credentials for two independent GPT calls; never persisted |
| 1 Feedback (optional) | Additional user briefing + previous quality report | User-supplied, explicitly unverified | Additional contextual text for semantic prompt |
| 2 Trace | Trace & extract | Existing CPU + evidence index | Source evidence, ID metadata, observed state paths |
| 2 Analyze | GPT interpretation or import candidate | Existing model prompt, evidence validator | Candidate with source references |
| 2 Validate | Validate contract | Interpreter; deterministic source checks | Partial validated semantic contract (research only) |
| 3A SID | Compile SID reference | Existing deterministic 00.8I SID compiler | Readable `.S` + PSID `.sid` (silent diagnostic) |
| 4A Compare | Original vs generated | Existing 00.8H/00.8I differential engine | Exact supported-scope diff and first divergence |
| 4A Optional listening | Two audio recordings | User (external renderer) | Local `<audio>` players + basic numerical features |
| 4A Quality | GPT | Differential report + user notes + audio features, not raw sound | Reviewable text + JSON quality report |
| 3B PLAY | Open Compiler | Existing deterministic AY control backend | Partial control assembly only — no playable music |
| 4B Optional listening | Original SID and an externally produced PLAY recording | User | Local audio players + basic numerical features |
| 4B Quality | GPT | Numerical metrics and user notes | Reviewable text + JSON quality report |

## State and safety rules

- Source/Complete Report is an exclusive input route. Changing the `.sid` resets the previously indexed evidence, candidate and compilation state. Complete Report input reuses its embedded original SID bytes.
- Compile SID is disabled until the Interpreter marks its contract structurally valid. Compilation independently enforces source hash, evidence and supported capabilities.
- Pressing Compile SID produces the exact same deterministic bytes as the matching 00.8I backend. In-memory bytes and contract are passed directly to the differential analyzer if the detailed-panel file inputs are empty.
- Two quality branches share the same key; one branch may generate a report without affecting the other. Quality reports contain `reviewStatus: needs_human_validation`.
- Quality estimates cannot be promoted to semantic proof. WAV/MP3 feature metrics are a diagnostic supplement, not listening by the AI.
- No browser storage or automatic cloud account connection is used.
