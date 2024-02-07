class PlayerWorklet extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.port.onmessage = this.onmessage.bind(this);
        this.sampleData = new Array();
        this.sampleBuffer = [];

        this.BufferSel = -1;
        this.BufferIdx = 0;
        this.BufferLen = 2;
        this.sampleIndex = 0;
    }

    onmessage(e)
    {
        switch(e.data.type)
        {
            case "data":
                this.sampleData = e.data.audio;
                this.sampleIndex = e.data.audio.length - 1;
                //this.port.postMessage({ message: 'data='+e.data.audio.length });
            break;
            case "play":
                this.sampleData = e.data.audio;
                this.sampleIndex = e.data.audio.length - 1;
            break;
            case "append":
                this.sampleData =  e.data.audio.concat(this.sampleData);
                this.sampleIndex += e.data.audio.length - 1;
            break;
            case "double_buffer":
                this.BufferSel++;
                if(this.BufferSel==this.BufferLen) this.BufferSel = 0;

                this.sampleBuffer[this.BufferSel] =  e.data.audio.concat(this.sampleData);
                //this.sampleIndex += e.data.audio.length - 1;
            break;            
        }
    }

    nextOutput()
    {
        const sample = this.sampleData[ this.sampleIndex ];
        if(this.sampleIndex > 0)
        { 
            this.sampleIndex--;    // sampleIndex = 0 means buffer empty
            if(this.sampleIndex==0)
            {
                this.port.postMessage({ message: 'buffer empty' });
                this.sampleData = new Array();
            }
            return sample;
        }
        else return 0.0
    }

    process(inputs, outputs)
    {
        const output = outputs[0];
        const channel = output[0];

        //this.port.postMessage({ message: 'l='+channel.length });
        for (let i = 0; i < channel.length; ++i)
        {
            const value = this.nextOutput();
            channel[i] = value;
        }
        return true;
    }
}

registerProcessor('player-worklet', PlayerWorklet);