class PlayerWorklet extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.port.onmessage = this.onmessage.bind(this);
        this.sampleData     = [];
        this.sampleIndex    = 0;
    }

    onmessage(e)
    {
        switch(e.data.type)
        {
            case "append":
                this.sampleData  =  e.data.audio.concat(this.sampleData);
                this.sampleIndex += e.data.audio.length - 1;
            break;
            case "clear":
                this.sampleData = [];
            break;     
        }
    }

    nextOutput()
    {
        const sample = this.sampleData[ this.sampleIndex ];
        if(this.sampleIndex > 0)
        { 
            this.sampleIndex--;    // sampleIndex = 0 means buffer empty
            if(this.sampleIndex==0) { this.sampleData = new Array(); this.port.postMessage({ message: 'empty' }); }
            return sample;
        }
        else return 0.0
    }

    process(inputs, outputs)
    {
        const output = outputs[0];
        const channel = output[0];    //this.port.postMessage({ message: 'l='+channel.length });

        for (let i = 0; i < channel.length; ++i)
        {
            const value = this.nextOutput();
            channel[i] = value;
        }
        return true;
    }
}

registerProcessor('player-worklet', PlayerWorklet);