class EmulatorWorklet extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.port.onmessage = this.onmessage.bind(this);
        this.sampleData  = [];
        this.sampleIndex = 0;
        this.dbg         = [];
    }

    onmessage(e)
    {
        switch(e.data.type)
        {
            case "load":
                this.debug(0);
                this.sampleData  = e.data.audio;
                this.sampleIndex = this.sampleData.length - 1;
            break;
        }
    }

    nextOutput()
    {
        this.debug(1);
        return this.sampleData[ this.sampleIndex==0?0:this.sampleIndex-- ]
    }

    process(inputs, outputs)
    {
        const output = outputs[0];
        const channel = output[0];
        for (var i = 0; i < channel.length; ++i)
            channel[i] = this.nextOutput();
        return true;
    }

    debug(idx)
    {
        switch(idx)
        {
            case 0:
                this.dbg[1] = this.dbg[1]===undefined ? 0 : ((this.dbg[1] + 1) % 3);
                if(this.dbg[1]==0)
                    this.port.postMessage({ message: 'buffer '+(this.sampleIndex - this.dbg[0]) });
                this.dbg[0] = 0;
            break;
            case 1:
                this.dbg[0] += this.sampleIndex==0?1:0;
            break;
        }
    }
}

registerProcessor('emulator-worklet', EmulatorWorklet);