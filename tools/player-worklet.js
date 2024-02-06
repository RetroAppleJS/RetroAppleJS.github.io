class PlayerWorklet extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.port.onmessage = this.onmessage.bind(this);
        this.playing = false;
    }

    onmessage(e)
    {
        if (e.data.type === 'play')
        {

            this.playing = !this.playing;    // Toggle between playing and silence
            this.phase = 0;
        }
    }

    nextOutput()
    {
        if (!this.playing) return 0.0;

        this.phase += 0.1;
        var out = Math.sin(this.phase);

        return out;
    }

    process(inputs, outputs)
    {
        const output = outputs[0];
        const channel = output[0];

        //this.port.postMessage({ message: 'l='+channel.length });

        for (let i = 0; i < channel.length; ++i) {
            const value = this.nextOutput();
            channel[i] = value;
        }
        return true;
    }
}

registerProcessor('player-worklet', PlayerWorklet);