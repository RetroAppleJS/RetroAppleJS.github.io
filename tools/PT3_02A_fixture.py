#!/usr/bin/env python3
"""Create an original 12-second CC0 PT3-02A diagnostic melody."""
from pathlib import Path
import sys
import mido

out = Path(sys.argv[1]) if len(sys.argv)>1 else Path("build/pt3_02a/original.mid")
out.parent.mkdir(parents=True, exist_ok=True)
song=mido.MidiFile(type=1,ticks_per_beat=480)
meta=mido.MidiTrack();song.tracks.append(meta)
meta.append(mido.MetaMessage("track_name",name="RetroAppleJS PT3-02A original",time=0))
meta.append(mido.MetaMessage("set_tempo",tempo=500000,time=0))
for channel,notes in enumerate(([60,62,64,67,69,67,64,62,60,64,67,72],
                               [48,48,53,53,55,55,53,53,48,53,55,48],
                               [72,76,79,76,72,76,79,76,72,76,79,72])):
    track=mido.MidiTrack();song.tracks.append(track)
    track.append(mido.MetaMessage("track_name",name=f"Test AY channel {channel+1}",time=0))
    for n in notes * 4:  # 12 seconds; visible HGR activity during the 6s test
        track.append(mido.Message("note_on",channel=channel,note=n,velocity=105,time=0))
        track.append(mido.Message("note_off",channel=channel,note=n,velocity=0,time=240))
song.save(out)
print(f"Wrote original test MIDI: {out}")
