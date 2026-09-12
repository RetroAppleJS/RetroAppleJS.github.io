from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(s.replace(old, new, 1))


dbg = "res/EMU_apple2debug.js"
manual = "docs/STEP_TRACE_MANUAL.md"
test = "tests/cpu_execution_condition.test.js"

replace_once(dbg,
'''    var runMode = "system";
    var fixedRunning = false;
    var runTimer = null;
    var resumePct = 1;

    // Step Over/Out are temporary debugger-owned live boundary runs.
''',
'''    var runMode = "system";
    var fixedRunning = false;
    var runTimer = null;
    var resumePct = 1;
    // After a manual Step In/Over/Out completes, retain the pause pictogram
    // until the user explicitly resumes or pauses continuous execution.
    var stepStop = false;

    // Step Over/Out are temporary debugger-owned live boundary runs.
''')

replace_once(dbg,
'''    function updateNavigationStatus(pc)
    {
        var el = document.getElementById("cpuDbg_navStatus");
        if(!el) return;

        el.textContent = "PC $"+oCOM.getHexWord(pc)
            +boundaryActionText()+breakpointText();
        var title = followPC
''',
'''    function formatInstructionCount(state)
    {
        var value = state && Number.isFinite(Number(state.ic)) ? Math.floor(Number(state.ic)) : 0;
        var modulo = 0x1000000000000; // 2^48, matching Cpu6502's live IC.
        value %= modulo;
        if(value<0) value += modulo;
        return value.toString(16).toUpperCase().padStart(12,"0");
    }

    function updateNavigationStatus(pc,state)
    {
        var el = document.getElementById("cpuDbg_navStatus");
        if(!el) return;
        if(!state)
        {
            var cpu = liveCPU();
            state = cpu && typeof(cpu.watch)==="function" ? cpu.watch() : null;
        }

        el.textContent = "PC $"+oCOM.getHexWord(pc)
            +"  INS $"+formatInstructionCount(state)
            +boundaryActionText()+breakpointText();
        var title = followPC
''')

replace_once(dbg,
'''        var cpu = liveCPU();
        if(cpu) updateRegisterStatus(cpu.watch(),force);
        return true;
''',
'''        var cpu = liveCPU();
        if(cpu)
        {
            var state = cpu.watch();
            updateNavigationStatus(pc,state);
            updateRegisterStatus(state,force);
        }
        return true;
''')

replace_once(dbg,
'''    function syncRunIcon(el)
    {
        el = el || document.getElementById("cpuDbg_play");
        if(!el || !el.classList) return;
        var running = executionRunning();
        var breakpointStop = !running && conditionalBreakpoint.hit && !conditionalBreakpoint.error;
        el.classList.toggle("fa-pause-circle",running);
        el.classList.toggle("fa-parking",breakpointStop);
        el.classList.toggle("fa-play-circle",!running && !breakpointStop);
        el.title = running
            ? "pause CPU execution"
            : (breakpointStop ? "paused at BREAK IF condition — click to continue" : "continue CPU execution");
    }
''',
'''    function syncRunIcon(el)
    {
        el = el || document.getElementById("cpuDbg_play");
        if(!el || !el.classList) return;
        var running = executionRunning();
        var breakpointStop = !running && conditionalBreakpoint.hit && !conditionalBreakpoint.error;
        var steppedStop = !running && !breakpointStop && stepStop;
        el.classList.toggle("fa-pause-circle",running || steppedStop);
        el.classList.toggle("fa-parking",breakpointStop);
        el.classList.toggle("fa-play-circle",!running && !breakpointStop && !steppedStop);
        el.title = running
            ? "pause CPU execution"
            : (breakpointStop
                ? "paused at BREAK IF condition — click to continue"
                : (steppedStop ? "paused after step — click to continue" : "continue CPU execution"));
    }
''')

replace_once(dbg,
'''    function startExecution()
    {
        // Leaving a breakpoint stop returns the main control from the
        // parking pictogram to the normal running state.
        conditionalBreakpoint.hit = false;
        stopBoundaryAction();
''',
'''    function startExecution()
    {
        // Leaving a breakpoint or manual-step stop returns the main control to
        // the normal running state.
        conditionalBreakpoint.hit = false;
        stepStop = false;
        stopBoundaryAction();
''')

replace_once(dbg,
'''    function pauseExecution()
    {
        stopBoundaryAction();
        stopFixedRun();
''',
'''    function pauseExecution()
    {
        stepStop = false;
        stopBoundaryAction();
        stopFixedRun();
''')

replace_once(dbg,
'''    function finishBoundaryAction()
    {
        stopBoundaryAction();
        resetClosedLoopDisplayState();
        var cpu = liveCPU();
        if(cpu) dbg.cycle({cpu:cpu,force:true});
        syncRunIcon();
    }
''',
'''    function finishBoundaryAction()
    {
        var completedStep = !!(boundaryAction && boundaryAction.instructions>0);
        stopBoundaryAction();
        resetClosedLoopDisplayState();
        if(!conditionalBreakpoint.hit) stepStop = completedStep;
        var cpu = liveCPU();
        if(cpu) dbg.cycle({cpu:cpu,force:true});
        syncRunIcon();
    }
''')

replace_once(dbg,
'''    function conditionalBreakpointHit(state)
    {
        conditionalBreakpoint.armed = false;
''',
'''    function conditionalBreakpointHit(state)
    {
        stepStop = false;
        conditionalBreakpoint.armed = false;
''')

replace_once(dbg,
'''        var watch = cpu.watch();
        updateRegisterStatus(watch,!!(obj && obj.force));
        var pc = watch.pc & 0xffff;
''',
'''        var watch = cpu.watch();
        updateRegisterStatus(watch,!!(obj && obj.force));
        var pc = watch.pc & 0xffff;
        updateNavigationStatus(pc,watch);
''')

replace_once(dbg,
'''        pauseExecution();
        var result = machine.stepLiveInstruction();
        if(result && result.ticks>0) rememberSequential(result.startPC,result.endPC);
        this.cycle({cpu:machine.cpuObj(),force:true});
        return result;
''',
'''        pauseExecution();
        var result = machine.stepLiveInstruction();
        if(result && result.ticks>0) rememberSequential(result.startPC,result.endPC);
        stepStop = !!(result && result.ticks>0) && !conditionalBreakpoint.hit;
        this.cycle({cpu:machine.cpuObj(),force:true});
        return result;
''')

replace_once(dbg,
'''        resetClosedLoopDisplayState();
        clearConditionalBreakpoint();
        syncRunIcon();
''',
'''        resetClosedLoopDisplayState();
        clearConditionalBreakpoint();
        stepStop = false;
        syncRunIcon();
''')

replace_once(dbg,
'''        return {
             "pc":cpu ? (cpu.watch().pc & 0xffff) : null
            ,"runMode":runMode
''',
'''        var state = cpu ? cpu.watch() : null;
        return {
             "pc":state ? (state.pc & 0xffff) : null
            ,"instructionCount":state && Number.isFinite(Number(state.ic)) ? Number(state.ic) : 0
            ,"stepStop":stepStop
            ,"runMode":runMode
''')

replace_once(dbg,
'''                        +"<select id='cpuDbg_speed' title='STEP TRACE execution speed' onchange='oEMU.component.CPU.Apple2Debug.setRunSpeed(this.value)' style='width:100px;height:18px;padding:0;font-size:9px;margin-left:67px'>"
''',
'''                        +"<select id='cpuDbg_speed' title='STEP TRACE execution speed' onchange='oEMU.component.CPU.Apple2Debug.setRunSpeed(this.value)' style='width:100px;height:18px;padding:0;font-size:9px;margin-left:auto'>"
''')

replace_once(manual,
'''| **Play / Pause / Breakpoint stop** | Starts or pauses CPU execution in the currently selected STEP TRACE speed mode. It shows `fa-play-circle` while paused, `fa-pause-circle` while running, and `fa-parking` when execution has stopped because `BREAK IF` matched. | — |
''',
'''| **Play / Pause / Breakpoint stop** | Starts or pauses CPU execution in the currently selected STEP TRACE speed mode. It shows `fa-play-circle` for the ordinary idle/paused state, `fa-pause-circle` while running **and after a Step In/Over/Out has completed**, and `fa-parking` when execution has stopped because `BREAK IF` matched. | — |
''')

replace_once(manual,
'''Step In always performs a literal single instruction step. Even when closed-loop display suppression is enabled, a manually requested Step In remains visible.
''',
'''Step In always performs a literal single instruction step. Even when closed-loop display suppression is enabled, a manually requested Step In remains visible. After a Step In, Step Over, or Step Out operation completes normally, the main execution pictogram is `fa-pause-circle`; a breakpoint stop still takes precedence and uses `fa-parking`.
''')

replace_once(manual,
'''```text
NAV  ↑  ↓   PC $xxxx
```
''',
'''```text
NAV  ↑  ↓   PC $xxxx  INS $xxxxxxxxxxxx
```
''')

replace_once(manual,
'''### `PC $xxxx`

This is the **live program counter**.

The PC indicator continues to represent the executing CPU even when the listing itself has been unlocked for manual browsing.
''',
'''### `PC $xxxx  INS $xxxxxxxxxxxx`

`PC` is the **live program counter**. `INS` is the live CPU's 48-bit instruction counter, rendered as exactly 12 hexadecimal digits. It counts completed opcodes since CPU reset and wraps at `2^48`, matching the counter already maintained by `Cpu6502.watch().ic`.

Both indicators continue to represent the executing CPU even when the listing itself has been unlocked for manual browsing.
''')

p = Path(test)
s = p.read_text()
append = r'''


test('STEP TRACE shows live 48-bit instruction counter and keeps pause icon after manual steps', () => {
    assert.match(debugSource,/INS \\$\"\+formatInstructionCount\(state\)/);
    assert.match(debugSource,/Number\.isFinite\(Number\(state\.ic\)\)/);
    assert.match(debugSource,/var steppedStop = !running && !breakpointStop && stepStop;/);
    assert.match(debugSource,/classList\.toggle\(\"fa-pause-circle\",running \|\| steppedStop\)/);
    assert.match(debugSource,/stepStop = !!\(result && result\.ticks>0\) && !conditionalBreakpoint\.hit;/);
    assert.match(debugSource,/if\(!conditionalBreakpoint\.hit\) stepStop = completedStep;/);
});

test('Cpu6502 watch exposes a reset-based instruction count that advances after an opcode', () => {
    const {cpu} = harness([0xEA,0xEA]);
    assert.equal(cpu.watch().ic,0);
    cpu.cycle();
    drain(cpu);
    assert.equal(cpu.watch().ic,1);
});
'''
if "STEP TRACE shows live 48-bit instruction counter" in s:
    raise SystemExit("test already patched")
Path(test).write_text(s + append)
