# Disk II topology UI state fix

## Scope

Fix two UI regressions that occur after attaching or detaching Disk II child devices:

1. The disk surface map must render only the attached physical drives.
2. Rebuilding Disk II peripheral controls must preserve the mounted filename of the still-attached drive.

## Approach

- Keep the existing Disk II runtime topology policy focused on motor/media state.
- Add a small UI-state topology policy loaded immediately after it.
- Generate Disk II media rows from `card.devices` and rehydrate the visible filename from `state.diskData[n]` / `state.diskName[n]`.
- Replace the fixed D1+D2 surface-map grid pair with a grid list derived from attached devices.
- Refresh the visible surface-map popup after attach/detach topology changes.

## Regression coverage

`tests/appledisk2_topology_ui_state.test.js` covers:

- loader includes the UI-state policy
- surface map shows D1-only, D2-only, or both according to attached devices
- attaching D2 preserves D1's filename
- detaching D2 preserves D1's filename
- detaching D1 preserves D2's filename
- an open surface-map popup is refreshed after topology changes
