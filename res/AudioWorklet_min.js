class EmulatorWorklet extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.port.onmessage = this.onmessage.bind(this);
        this.sD  = [];
        this.sI = 0;
    }

    onmessage(e)
    {
        switch(e.data.type)
        {
            case "load":
                this.sD  = e.data.audio;
                this.sI = this.sD.length - 1;
            break;
        }
    }

    nextout()
    {
        return this.sD[ this.sI==0?0:this.sI-- ]
    }

    process(inputs, outs)
    {
        const out = outs[0];
        const ch = out[0];
        for (var i = 0; i < ch.length; ++i)
            ch[i] = this.nextout();
        return true;
    }
}

registerProcessor('emulator-worklet', EmulatorWorklet);