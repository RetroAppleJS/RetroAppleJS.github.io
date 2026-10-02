//
// EMU_CARD_dithertizer.js
//
// Computer Stations Dithertizer II video digitizer.
//
// The original DSCAN 4.2 driver uses only two slot-I/O addresses:
//   $C0n0 write : latch 8-bit threshold and disable capture
//   $C0n0 read  : read sync in D7 and disable capture
//   $C0n8 read  : enable capture
//
// DSCAN selects HGR page 1/2 through the normal Apple II $C054/$C055
// soft switches, so the card follows the current video page rather than
// maintaining a private page-select register.
//

function DithertizerII()
{
    var card=this;
    var cameraSource=null;
    var hostCameraStream=null;
    var hostCameraVideo=null;
    var hostCameraCanvas=null;
    var hostCameraContext=null;
    var hostCameraEpoch=0;
    var hostCameraPending=false;
    var hostCameraFrame=new Uint8Array(280*192);
    var hostCameraControlID=null;
    var wasmEnabled=true;
    var wasmWorker=null;
    var wasmWorkerURL=null;
    var wasmPending=null;
    var wasmRequestId=0;
    var wasmError=null;
    var syncTraceEnabled=false;
    var syncTraceEntries=[];
    var syncTraceLastD7=null;
    var syncTraceLastTick=null;

    const HGR_WIDTH=280;
    const HGR_HEIGHT=192;
    const HGR_BYTES_PER_LINE=40;
    const APPLE_FRAME_CYCLES=17030;
    const DSCAN_TRACE_PC_MIN=0x1D23;
    const DSCAN_TRACE_PC_MAX=0x1D35;
    const SYNC_TRACE_LIMIT=512;
    // The bundled HGR quantizer is the same WASM module used by ConvertHGR.
    // DSCAN still owns the displayed HGR page through the comparator.
    const WASM_HGR_BASE64="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";
    // Original disk picture: the complete monochrome HGR $4000-$5FFF page.
    const SAMPLE_HGR_BASE64="AAAAKlUqVSpVKlUqVWpdK3duXSpXKlUqVSpVKlUqVSpVKlUqVSpVKn9/Xyp/f38PfD99f39/HwgBIH9/f39/f39/f39/f39/f39/f39/f38AAAAAAAAAAEB+f39/f38vfWN/en9/X35/f30/dSpValUiQCt/f18qfHwCAnx8AgIAAAAAUH9/f39/f39/f39/f39/f39/f39/f39/f29ff3duXTt3bl07f39/fxcqVT9xP3AvFXp/f18gBCh/f39/f39/f39/f39/f39/f39/fwAAAAAAAAAAAAAAAFB/f39/f396X351P19qf39Xbn8/FSJEKlUqVQp8fAICfHwCAnAvAAAAAHR/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38jfx98Y19/f39/ABEgfX9/f39/f39/f39/f39/f39/AAAAAAAAAAAAAAAAAAAAAHR/f39/f18qfz5/f1EqVSoVKkUAAAAAKHx8AgJ8fAICdH9/PwEAAAB9f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38LESB0f3UrH35XKn9/fwNEAH1/f39/f39/f39/f39/f38AAAAAFAAAAAAAAAAAAAAAAAAAAH1+f39/f39/dSpVahUiRD4BAAAAfHwCAnx8AgJ8LwAAcD8BAAAAfX9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fw9Vfn8of39/fld/fHt/f30PEQJ9f39/f39/f39/f39/fwAAAAAAAAAAQAoAAAAAAAAAAAAAAAAAAH9+f393b187FSJEeH9vXWJ8fQICfHwCAn8DQH5/AHx/AQAAAH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/A3wARD9/Kn1/dy99a1d/VX9/P0UKdX9/f39/f39/f39/AAAAAAAAAAAAAAAAACAFAAAAAAAQAAAAAAAAAHd+VypXIkR4f29dK3x8AgJ8fAICfwNAf39/QX9/fwUAACB/f39/f39/f39/f39/f39/f39/f39/f39/fwAgf39/f38rdX8PAH8vfz9Vf39/d391L39/f38BInR/f39/f39/f38AAAAAAAAAAAAAAAAAAAAAAABAAgAAVCoRKl0qAQAAIFcCBCB/f1UKfHwCAnx8AgJ/P1V+f39/PxF+f38HAAAof39/f39/f39/f39/f39/f39/f39/f39/AAAAAAB6f38fKlUqfy9/D3VrX3pXf38/fX9dP1FqBwhQf39/f2pVKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIH9/f39/f39/dypVCAAgfyt8fAICfHwCAgAAAFAqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlV/fw8Afn9/B3hfeH9/fy8AAAB6f39/f39/f39/f39/f39/f39/f29fAAAAAAAAAAAAUGp9f39/XypBP3Avfw99f39qXypVCFEAAABQen8qEXx8AgJ8fAICAAAAAABVKlUqVypVO1UqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVX9/f38/AHh/YD9gHzpwf38/AQAAen9/f39/f39/f39/f39/f39/f18AAAAAAAAAAAAAAAAAVGp/f39/VQ98Y18+VX5/AkAuVQIAAAAAQAAAfHwCAnx8AgIoVQAAAAAgXTt3bl07d25dO3duXTt3KlUqVSpVKlUqVSpVKlUqVSpVf39/f39/f39/f38feEEvfX9/fwUAAGh/f39/f39/f39/f39/f39/fwAAAAAAAAAAAAAAAAAAAAAAV35/f38vUT9cfn8CUCgRAgAAAAAAAAB8fAICfHwCAihValUCAAAAKH9/f39/f39/f29dO3duXTt3bl07d2pVO1duVSpVKlV/f39/f39/AQAAYH97RQ98I0d+f38XAABof39/f39/f39/f39/f39/AAAAAAAAAAAAAAAAAAAAAAAAAAAgVX5/f39+fysFAFUCAABcAwAAAHx8AgJ8fAICOgUAACB3AgAAAGh/f39/f39/f39/f39fe39uXTt3bl07d25dO3cuXX9/f39/f38fAHR/AX9/fn0Df2h1a396HwAAaH9/f39/f39/f39/f38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgVX5/K1UqVQoAAFArVypRfHwCAnx8AgI6AQB9PwFgfwMAAAB6f39/f39/f39/f39/f39/P3duXTt3bl07d25dKn9/f39/fwF4AQB8fwF4fytfflEjfyp/f38CACB/f39/f39/f39/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAodS4RKgAAUCpXCkV8fAICfHwCAn4FAH9/f0B/f38LAAAAen9/f39/f39/f39/f39/f39/e3duXTt3bl0AAChVf39/V2p/DwB+B34fIn1/fS9/aB8+f35/AwAAfX9/f39/f39/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVAEQqFQAAAAAKAABAKn8KBHx8AgJ8fAICfx8AfX9/fx8AdH9/DwAAAHp/f39/f39/f39/f39/f39/f39/O3dvXQAAAAAAQCp9P1AqVX4HfgcAQD9RL39/f3p/KB8gQA4AAH1/fytVKhEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABof39/P3d+fytVAgAAAGgRfHwCAnx8AgIAAAAoVSpVblU7d25dO3duXTt3bl07VSpVK1UqVSpVKlUqVSpVKlUqf39/Kn1/fw98P31/f39/AgAAdX9/f39/f39/f39/f39/f39/f39/fwAAAAAAAAAAAAB/f39/fz9dKH96X39Xen9/f39VeldqRQgAKn1/Vyp8fQICfHwCAgAAAAAAen9/f39/f39/f39/f39/f39/bl0/d25dO3duXTt3bl07d25/f39/f39/f1U/cA98Kn1/fwsAAHR/f39/f39/f39/f39/f39/f39/AAAAAAAAAAAAAAAAAGh/f39/f2tffncvXyt/f1UKdS5VCAECQAgVInx8AgJ8fAICVDsFAAAAQH5/f39/f39/f39/f39/f39/f39/f39/f39/f39/XTt3bn9/f39/f39/VX9/D3wDX35/f38PQABwf39/f39/f39/f39/f39/f38AAAAAAAAAAAAAAAAAAAAAAHh/f39/f25/Pn9/RShVKgUIAQIAAAAAfHwCAnx8AgJ8f39/BQAAAEB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fytwP0B+fysffkc/f39/PwAiVH9/f39/f39/f39/f39/fwAAAAAAKAAAAAAAAAAAAAAAAAAAADp3f39/f39dPlUuBQAAfh8AAAB8fAICfHwCAnwLAABAfwcAAABwf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/P0BqfyN/P39/Vz9wa1V/fX8FAFB+f39/f39/f39/f39/AAAAAAAAAAAAABUAAAAAAAAAAAAAAAAAQD5/f186dy4VAAFofy9XYnx8AgJ8fAICfwNAfn8DcH8fAAAAdH9/f39/f39/f39/f39/f39/f39/f39/f39/f1V/f39/f38DcAMAfn8vdX9Xf39rR391f39/ByJAfn9/f39/f39/f38AAAAAAAAAAAAAAAAAAAACAAAAAEAIAAAAAAAAQDt/K1UAAGBfL1UqfHwCAnx8AgJ/A0B/f39Bf39/HwAAAHR/f39/f39/f39/f39/f39/f39/f39/f39/AABQbn9/fy9Vfx8Afg9/f1V6f39ff3UvfT5/fx8AAH5/f39/f39/fwAAAAAAAAAAAAAAAAAAAAAAAAAABABAKlUqfy5VCgAAAAABIFV/fwp8fAICfHwCAn8/UX5/f38vFXh/f38AAAB0f39/f39/f39/f39/f39/f39/f39/f38AAAAAAAB0f38jVSp/L30PQCh/al9/f39dfn0/fAt9AAB6f39VO1UqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVH9/f39/f39/fwUAAABQKnx8AgJ8fAICAAAAQCpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVX9/PwBof2IHeB94B35/fwcAACB/f39/f39/f39/f393b107d25dO3cAAAAAAAAAAAAAKFV+f39/KEU/cA99K3F/f39/ClUqRQAAAERqXSoAfH0CAnx8AgIAAAAAAFAqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVf39/f39/f38LFWAXeBFgf38XAAAgfX9/f39/f39/f39/f3t3bl07dwAAAAAAAAAAAAAAAAAAKnV/f39HDn0jVy5Vfn8KAQJUAAAAAAAAAAB8fAICfHwCAihVCgAAAAB0bl07d25dO3duXTtVKlUqVSpVKlUqVSpVKlUqVSpVKlV/f39/f39/HwB9fx94QQ98Yn9/VwAAAH9/f39/f39/f39/P3d+XTt3AAAAAAAAAAAAAAAAAAAAAABAKnV/fz9VLx16fwBAKhQAAAAEAAAAAHx8AgJ8fAICKFUqVQoAAAAAXT93bl07d25dO3duXTt3bl0rVSpVKlUqVSpVKlUqVX9/f39/f38DYH8AQH9RD3wDX3p/f18CAAB9f39/f39/f39/d29dO3cAAAAAAAAAAAAAAAAAAAAAAAAAAABQKnV/f39/KlQCVAoAAFQqAAAAfHwCAnx8AgIqBQAAAFwrAAAAIH9/f39/f39/f39dO3duXTt3bl07dy5VKlUqVSpVf39/f39/f38AUH8Bfh9+fysdIFFqXXh3CgAAdH9/f39/f39/b387dwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQKncOUCJVCAAAUGpVAkB8fAICfHwCAmoBAHduBSB/LwAAACB/f39/f39/f39/f39dO3duXTt3bl07d25VK1UqVX9/f39/AWAHAHB/F2B/K39/RwJ9aFdofysAAFR/f39/f39/Xzt3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQKlUoAABAKl0qRHx8AgJ8fAICbgUAf39/A39/fz8AAAAgf39/f39/f39/f39/d25dO3duXTt3bl07VwAAAFRqfX8XCH8/AH4Hfn8vdH91b30jFwhdIncoAABwf39/f39fKlUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFQKVSpVCgEAAAAAAEAKVTsFfHwCAnx8AgJ+XwB0f39/BwBAf39/AQAAIH9/f39/f39/f39/fl87d25dO3duXTt3AAAAAAAAIFVqFyBVfxd6BwJAP0VufX9/Kl16FygBKAEAUH9/KlUqBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9f39/XXt/f10CAAAAAAB8fAICfHwCAgAAAAB3bl9/f39/f39/f39/f39/f25dO3d+XTt3bl07d25dO3duXSt/f38rVS50D3w/dC99f38/AAJQf39/f39/f39/f39/f39/f39/f39/AAAAAAAAAAAAAEB/f39/f1dqf3pffn9rf39/f1duXy8VKkQqdX9VKnx8AgJ8fAICUAAAAABof39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f25dO39/f39/f39/VwpwH3wrVX9/P0EIUH5/f39/f39/f39/f39/f39/f38AAAAAAAAAAAAAAAAAAHB/f39/P19+Vz9ffn9/VSpVKhUqRQAAAEQqfHwCAnx8AgJ0f18AAAAAeH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fw8Qen8/fUNffld/f38BIkB+f39/f39/f39/f39/f39/fwAABQAAAAAAAAAAAAAAAAAAAHx/f39/f38+fX8VKlUuBSJFDgAAAAB8fAICfHwCAnx/f39/AAAAAH5/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/K3V/R2h/b19+Rz99e39/BwgBen9/f39/f39/f39/f39/AAAAAAAAUAAAAAAAAAAAAAAAAAAAAF1/f39/f3dqVyoXIkR6fwIAAHx8AgJ8fAICfQMAAAB+fwAAAEB+f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/ASB/K38/fX93PnRrdy99fx8gBHp/f39/f39/f39/f38AAAAAAAAAAAAAACgBAAAAAAAAAAAAAAAAAH1/Xyp1OhciRXh/L1UifHwCAnx8AgJ/A0B/fw9wf38CAABQfn9/f39/f39/f39/f39/f39/f39/f39/f39/V3p/f39/fytxPwB4fy91f3d/fztXf3U/dX9/ABVqf39/f39/f39/fwAAAAAAAAAAAAAAAAAAAAAUAgAAACoFAAAAAAAAIF9/fSJEKH8/VQp8fAICfHwCAn8PQH9/f0d/f39/AwAARH9/f39/f39/f39/f39/f39/f39/f39/f38AAABof39/P1V+fwp9D35/f3p/e3d/dz9RflU/dQMEaH9/f39/f1U6AAAAAAAAAAAAAAAAAAAAAAAAAAAAKgBqV25/f3cqBQAAKgUgVX9/C3x8AgJ8fAICf39Ven9/fw91Y39/fw8AAFB/f39/f39/f39/f39/f39/f39/f39/fwAAAAAAAAB+f39Ban8vdQ9/Yn96X39/f1d+fT9dIlQPVSJ/P3d/XSoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVfn9/f39/f39/RwAAAAAofHwCAnx8AgIAAAAAKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVf39/ByIAaB94f2AfKH9/XwAAAHx/f39/f39/f39/f39/f39/f39vXQAAAAAAAAAAAAAAVCp/f38vVT9wD31rV39/f38iVSpVAgAAESpVCgF8fAICfHwCAiAAAAAAQG5dO3duXTt3bl07dy5VKlUqVSpVKlUqVSpVKlUqVSpVKlV/f39/f39/fy8FaB94VQB/f38CAAB0f39/f39/f39/f39/f39/f39/AAAAAAAAAAAAAAAAAAAAXXp/f38vfWMfPl1+fyoBABECAAAAAAAAUHx8AgJ8fAICKFUqAQAAAFA7d39/f39uXTt3bl07d25dO3duXStVKlUqVSpVKlUqVX9/f39/f38HAEB/X3pBD3wrdH9/AwAAUH9/f39/f39/f39/f39/f38AAAAAAAAAAAAAAAAAAAAAAAAAVX9/f38/XX5/A1AqVQIAABQAAAAAfHwCAnx8AgIoVQpRKwEAAAB0f39/f39/f39/f39/bl07d25dO3duXTt3bl0qVypVf39/f39/fxdifwdAf18OfQN/enV/fw8AAFB/f39/f39/f39/f39/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgVXp/f38jVSoRCgAAVDsHAAB8fAICfHwCAjoFAAAAcH8BAAAAfH9/f39/f39/f39/f39/f387d25dO3duXTt3bl1/f39/f39/fwMAeAd+F35/KwVoUStXaH8/AABQf39/f39/f39/f39/AAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAoVTtFKFUKAABQKkcIQXx8AgJ8fAICOgEAfX8XYH9/BwAAAHR/f39/f39/f39/f39/f39/f187d25dO3duXSBVfn9/f38VYn8AQH9Xan8vf39XIn9oXyJ/fwEAQH5/f39/f39/f38AAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAoVTsAAFAqXygFfHwCAnx8AgJ/BwB/f38Df39/fwcAAAB8f39/f39/f39/f39/f39/f39/b107d25dAAAAACp1f38gdD8Bfgd+f391L30jfysfAnwqHSAHAAB+f39/f1UqVQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUCpVbl8rVQoAAAAAQCJXbhV8fAICfHwCAn9/A3F/f38HeEd+f38fAAAAfH9/f39/f39/f39/f39/f39/fz93b10AAAAAAAAAUCp/D3R/X2oHfkM+dS9/f38/f3gfCgEAHQAAel8qVyoRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIH1/f39/f39/fw8AAAAAEHx8AgJ8fAICAAAAAFQ7d29ff3d/f39/f19/f25dO3duXTt3bl07d25dO3duXStXKn9/fy9UKlU/eD9wL0V+f38FAABqf39/f39/f39/f39/f39/f39/f38AAAAAAAAAAAAAACB/f39/fy9/el9+dW9ff39/VSt1bkUKUSpVO1UifHwCAnx8AgJQCgAAAAB/f39/f39/f39/f39/f39/f39/f39/Xzt3bl07d25dO3duf39/f39/f39fKn0PfCtXf39/FwAAeH9/f39/f39/f39/f39/f39/fwAAAAAAAAAAAAAAAAAAAGh/f39/X35XL18+f399O1UqRQgRAgAAAGp8fAICfHwCAlR7fwIAAABgf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f25/f39/f39/AwAAfy99Ax9+V2p/fx8AAWh/f39/f39/f39/f39/f39/AAAAAAAAAAAAAAAAAAAAAAAAAHp/f39/fz99f0Vof24FABA+AAAAAHx8AgJ8fAICfD8BIH8LAAAAaH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38nVX8fYn9/X35HP3V6f39/IgAof39/f39/f39/f39/f38AAAAAAAAAIAUAAAAAAAAAAAAAAAAAAG59f39/VT5VKlUAEXh/KxFgfHwCAnx8AgJ8AwBoBWB/DwAAAGh/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38HAHAvfwp/f1cqdWNXP3V/fwsRIH9/f39/f39/f39/fwAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAQG59K1UqFQAQaH8vVQJ8fAICfHwCAn8DQH9/P0B/fw8AAAB4f39/f39/f39/f39/f39/f39/f39/f39/f39AKnd/f39/K3V/A2B/L39/fX9/L1V/cW9Xf38PRAB9f39/f39/f39/AAAAAAAAAAAAAAAAAAAAAAAoAQAAABUAAAgRAAAAQG5/AAFiXT9VCnx8AgJ8fAICfw8Bf39/X39/f38/AAAAen9/f39/f39/f39/f39/f39/f39/f39/fwAAAABUe39/UWpfKn0Pfz9/e1d6V39XPlV/VS5APgAAfX9/f38rVSoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECJ9f39/X3tXKlUKFQBVfncrfHwCAnx8AgJ/f1dqf39/D3wvf39/PwEAAHp/f39/f39/f39/f39/f39/f39/f39/AAAAAAAAAAB9f39/fz91L38Df3pff39/f391P1wKETpFCHQvfX9XKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFR+f39/f39/f38fAAAAACB8fAICfHwCAgAAAAAgVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlV/f39/ABAiH2gfYEcAdH9/DwAAQH5/f39/f39/f39/f29fO3duXTt3AAAAAAAAAAAAAAAAKFV/f39fPnQPfWNXDlF/fypVKlUAAAAAABUCAHx8AgJ8fAICKAUAAAAAKFUqXSpVblUqVSpVKlUqVSpVKlUqVSpVKlUqVSpVKlUqVX9/f39/f39/PxB6H3hBI39/fy8AAEB+f39/f39/f39/f39/d29dO3cAAAAAAAAAAAAAAAAAAABAKn1/fz99KwcuHXp/aFEAQAAAAAAAAABAfHwCAnx8AgIoVSoFAAAAAG5dO3duXTt3bl07d25dKlUqVSpVKlUqVSpVKlUqVSpVf39/f39/fwEAAHgfaEEPfCtRf38vAABAfn9/f39/f39/f39/b107dwAAAAAAAAAAAAAAAAAAAAAAAABAKl1/fz8den8CACpVAgAAVAAAAAB8fAICfHwCAigVAAAoFQAAAEB6f39/f39/Xzt3bl07d25dO1cuVStVKlUqVSpVKlV/f39/f39/Bwh9P0B/fy99A184dX9/OwUAAHp/f39/f39/f39/XTt3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQKn1/fwpVKlUIAABUalUqQHx8AgJ8fAICKgEAdAoAOhcAAABAfn9/f39/f39/fz93bl07d25dO3cuVSpVKlUqVW5/f39/f38HDgAgRz4Aen8rUXpBIl0if38VAABof39/f39/f39fO3cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQKl0CVAoAAFAqVSpAfHwCAnx8AgJuAQB/fx8gf39fAAAAQH9/f39/f39/f39/fz93bl07d25dO3duXTtVAFAqdX9/f0FofwNAfgd+HyB/f18qfWBHDn1/VwAAeH9/f39/f387dwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAABUKgAAQCodAAR8fAICfHwCAn4dAH9/f39/AH9/fwAAAEB/f39/f39/f39/f39vXTt3bl07d25dO3cAAAAAAFU6fwMRAFV+B34HaFELdAt9L1VqXyoXAFQAAGh/f38vVSpEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAal07dypVKlUKAQAAAFArFXx8AgJ8fAICfn8DQH9/fwd4H3p/f38DAABAf39/f39/f39/f39/P3duXTt3bl07dwAAAAAAAAAAKFV6f39/Ywd+QT90L30/f39/en8IAQBQAAAgVypdKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAodX9/f39/f39/DwAAAAAAfHwCAnx8AgI=";

    this.id={"PCODE":"DITHER","icon":"fa fa-camera"};
    this.state={
         "active":true
        ,"threshold":0
        ,"captureEnabled":false
        ,"page2":false
    };

    // Host image adjustments only. The card itself remains a one-bit comparator;
    // DSCAN supplies four thresholds and merges the 2x2 Bayer phases (0 2 / 3 1).
    var uiState={"brightness":0,"contrast":100,"gamma":100};
    var lumaLookup=new Uint8Array(256);

    function updateLumaLookup()
    {
        var brightness=uiState.brightness*255/100;
        var contrast=uiState.contrast/100;
        var exponent=100/uiState.gamma;
        for(var i=0;i<256;i++)
        {
            var level=((i-127.5)*contrast+127.5+brightness)/255;
            level=Math.max(0,Math.min(1,level));
            lumaLookup[i]=Math.round(255*Math.pow(level,exponent));
        }
    }
    updateLumaLookup();

    function hgrLineAddress(pageBase,y)
    {
        return pageBase
            + ((y & 0x07) << 10)
            + ((y & 0x38) << 4)
            + ((y & 0xC0) >> 1)
            + ((y & 0xC0) >> 3);
    }

    function decodeBase64(value)
    {
        var alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var bytes=[],word=0,bits=0;
        for(var i=0;i<value.length;i++)
        {
            var digit=alphabet.indexOf(value.charAt(i));
            if(digit<0) continue;
            word=(word<<6)|digit;
            bits+=6;
            if(bits>=8)
            {
                bits-=8;
                bytes.push((word>>bits)&0xFF);
            }
        }
        return new Uint8Array(bytes);
    }

    function sampleLumaFrame()
    {
        var page=decodeBase64(SAMPLE_HGR_BASE64);
        if(page.length!==8192) throw new Error("Invalid Dithertizer sample HGR page");
        var frame=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);
        for(var y=0;y<HGR_HEIGHT;y++)
        {
            var source=hgrLineAddress(0,y);
            for(var xb=0;xb<HGR_BYTES_PER_LINE;xb++)
            {
                var value=page[source+xb];
                for(var bit=0;bit<7;bit++)
                    frame[y*HGR_WIDTH+xb*7+bit]=(value & (1<<bit)) ? 255 : 0;
            }
        }
        return frame;
    }
    var sampleFrame=sampleLumaFrame();

    function writableHardware(hw)
    {
        if(!hw) return null;

        if(Array.isArray(hw.WR) && typeof(hw.lineDecode)==="function")
        {
            return {
                write:function(addr,d8)
                {
                    var line=hw.lineDecode(addr);
                    var fn=hw.WR[line];
                    if(typeof(fn)!=="function") return false;
                    fn(addr,d8);
                    return true;
                }
            };
        }

        if(typeof(hw.write)==="function") return hw;
        return null;
    }

    function resolveHardware(ctx)
    {
        var hw=writableHardware(ctx && ctx.hw);
        if(hw) return hw;

        hw=writableHardware(ctx && ctx.vid && ctx.vid.hw);
        if(hw) return hw;

        if(typeof(apple2plus)!=="undefined" && apple2plus && typeof(apple2plus.hwObj)==="function")
            return writableHardware(apple2plus.hwObj());

        return null;
    }

    function currentPage2(ctx)
    {
        if(ctx && ctx.vid && ctx.vid.state && typeof(ctx.vid.state.page2)==="boolean")
            return ctx.vid.state.page2;

        return false;
    }

    function clockTicks(ctx)
    {
        if(ctx && ctx.io && typeof(ctx.io.getClockTicks)==="function")
            return Number(ctx.io.getClockTicks()) || 0;

        if(typeof(oEMU)!=="undefined" && oEMU && oEMU.component && oEMU.component.IO &&
           oEMU.component.IO.self && typeof(oEMU.component.IO.self.getClockTicks)==="function")
            return Number(oEMU.component.IO.self.getClockTicks()) || 0;

        return 0;
    }

    function syncPhase(ticks)
    {
        return ((Number(ticks)||0)%APPLE_FRAME_CYCLES+APPLE_FRAME_CYCLES)%APPLE_FRAME_CYCLES;
    }

    function currentPC()
    {
        try
        {
            if(typeof(apple2plus)!=="undefined" && apple2plus && typeof(apple2plus.cpuObj)==="function")
            {
                var cpu=apple2plus.cpuObj();
                if(cpu && typeof(cpu.watch)==="function")
                {
                    var state=cpu.watch();
                    if(state && Number.isFinite(Number(state.pc))) return Number(state.pc)&0xFFFF;
                }
            }
        }
        catch(e){}
        return null;
    }

    function traceSyncD7(ticks,d8)
    {
        if(!syncTraceEnabled || syncTraceEntries.length>=SYNC_TRACE_LIMIT) return;

        var pc=currentPC();
        if(pc===null || pc<DSCAN_TRACE_PC_MIN || pc>DSCAN_TRACE_PC_MAX) return;

        var d7=(Number(d8)&0x80) ? 1 : 0;
        if(syncTraceLastD7!==null && d7===syncTraceLastD7) return;

        var now=Math.trunc(Number(ticks)||0);
        var entry={
             "index":syncTraceEntries.length
            ,"pc":pc
            ,"clockTicks":now
            ,"phase":syncPhase(now)
            ,"d7":d7
            ,"deltaTicks":syncTraceLastTick===null ? null : now-syncTraceLastTick
        };
        syncTraceEntries.push(entry);
        syncTraceLastD7=d7;
        syncTraceLastTick=now;

        if(typeof(console)!=="undefined" && console && typeof(console.log)==="function")
        {
            var pcHex=pc.toString(16).toUpperCase().padStart(4,"0");
            var width=entry.deltaTicks===null ? "start" : String(entry.deltaTicks)+" cycles";
            console.log("Dithertizer DSCAN sync transition #"+entry.index+
                " PC=$"+pcHex+" ticks="+entry.clockTicks+" phase="+entry.phase+
                " D7="+entry.d7+" width="+width);
        }
    }

    function syncD7(ticks)
    {
        var phase=syncPhase(ticks);
        if(phase < 64) return 0x00;
        if(phase < 96) return 0x80;
        if(phase < 103) return 0x00;
        return 0x80;
    }

    function normalizeSourceFrame(frame)
    {
        if(frame instanceof ArrayBuffer) frame=new Uint8Array(frame);
        else if(typeof(ArrayBuffer)!=="undefined" && typeof(ArrayBuffer.isView)==="function" && ArrayBuffer.isView(frame))
            frame=new Uint8Array(frame.buffer,frame.byteOffset,frame.byteLength);

        if(!frame || typeof(frame.length)!=="number" || frame.length < HGR_WIDTH*HGR_HEIGHT)
            throw new Error("Dithertizer camera source must provide at least 280x192 luminance bytes");

        return frame;
    }

    function sourceFrame()
    {
        if(cameraSource && typeof(cameraSource.getLumaFrame)==="function")
            return normalizeSourceFrame(cameraSource.getLumaFrame(HGR_WIDTH,HGR_HEIGHT));
        return hostCameraStream ? hostCameraFrame : sampleFrame;
    }

    this.setCameraSource=function(source)
    {
        if(source!==null && source!==undefined && typeof(source.getLumaFrame)!=="function")
            throw new TypeError("Dithertizer camera source must expose getLumaFrame(width,height)");

        cameraSource=source || null;
        return cameraSource;
    };

    this.getCameraSource=function(){return cameraSource;};

    this.setSyncTrace=function(enabled)
    {
        syncTraceEnabled=!!enabled;
        syncTraceEntries=[];
        syncTraceLastD7=null;
        syncTraceLastTick=null;
        if(syncTraceEnabled && typeof(console)!=="undefined" && console && typeof(console.info)==="function")
            console.info("Dithertizer DSCAN sync trace enabled for PC $1D23-$1D35");
        return syncTraceEnabled;
    };

    this.clearSyncTrace=function()
    {
        syncTraceEntries=[];
        syncTraceLastD7=null;
        syncTraceLastTick=null;
    };

    this.getSyncTrace=function(){return syncTraceEntries.slice();};
    this.dumpSyncTrace=function()
    {
        var out=card.getSyncTrace();
        if(typeof(console)!=="undefined" && console)
        {
            if(typeof(console.table)==="function") console.table(out);
            else if(typeof(console.log)==="function") console.log(out);
        }
        return out;
    };

    this.readVideoSync=function(ctx)
    {
        var ticks=clockTicks(ctx);
        var d8=syncD7(ticks);
        traceSyncD7(ticks,d8);
        return d8;
    };
    this.stopCapture=function(){card.state.captureEnabled=false;};

    this.startCapture=function(ctx)
    {
        card.state.captureEnabled=true;
        card.state.page2=currentPage2(ctx);

        var hw=resolveHardware(ctx);
        if(!hw) return false;

        var pageBase=card.state.page2 ? 0x4000 : 0x2000;

        var frame=sourceFrame();
        var threshold=card.state.threshold & 0xFF;

        for(var y=0;y<HGR_HEIGHT;y++)
        {
            var line=hgrLineAddress(pageBase,y);
            var row=y*HGR_WIDTH;
            for(var xb=0;xb<HGR_BYTES_PER_LINE;xb++)
            {
                var d8=0;
                var x0=xb*7;
                for(var bit=0;bit<7;bit++)
                    if(lumaLookup[frame[row+x0+bit]&0xFF] >= threshold)
                        d8 |= (1 << bit);
                hw.write(line+xb,d8&0x7F);
            }
        }
        return true;
    };

    this.readSlotIO=function(addr,ctx)
    {
        var reg=Number(addr)&0x0F;
        var safe=ctx && ctx.bRO===true;
        switch(reg)
        {
            case 0x00:
            {
                var d8=card.readVideoSync(ctx);
                if(!safe) card.stopCapture();
                return d8;
            }
            case 0x08:
                if(!safe) card.startCapture(ctx);
                return 0x00;
        }
        return 0x00;
    };

    this.writeSlotIO=function(addr,d8,ctx)
    {
        var reg=Number(addr)&0x0F;
        if(reg===0x00)
        {
            card.stopCapture();
            card.state.threshold=Number(d8)&0xFF;
        }
        return 0x00;
    };

    function uiNumber(value,min,max)
    {
        value=Number(value);
        if(!Number.isFinite(value)) return null;
        return Math.max(min,Math.min(max,Math.round(value)));
    }

    function uiValue(setting,value)
    {
        return setting==="gamma" ? (value/100).toFixed(2) : String(value)+"%";
    }

    function uiReadout(controlID,setting,value)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!=="function") return;
        var el=document.getElementById(controlID+"_"+setting+"_value");
        if(el) el.textContent=uiValue(setting,value);
    }

    // This function is serialized into a Blob Worker along with the WASM bytes.
    // The worker returns palette luminance, never writes to Apple II memory.
    function wasmWorkerMain(base64)
    {
        var backend=null;
        var loading=null;
        var paletteLuma=[0,156,145,255,0,145,156,255];

        async function load()
        {
            if(backend) return backend;
            if(!loading) loading=(async function()
            {
                var binary=atob(base64);
                var bytes=new Uint8Array(binary.length);
                for(var i=0;i<bytes.length;i++) bytes[i]=binary.charCodeAt(i);
                var result=await WebAssembly.instantiate(bytes,{});
                backend=result.instance.exports;
                return backend;
            })();
            return loading;
        }

        self.onmessage=async function(event)
        {
            var msg=event.data || {};
            try
            {
                var wasm=await load();
                var source=new Uint8Array(msg.rgb);
                if(source.length!==280*192*3) throw new Error("Invalid HGR source frame");
                var memory=wasm.memory.buffer;
                new Uint8Array(memory,wasm.hgr_get_source_ptr(),source.length).set(source);
                // Neutral ConvertHGR settings: diffusion with the original
                // browser port's colour metric and Atkinson coefficients.
                new Float64Array(memory,wasm.hgr_get_settings_ptr(),15).set([
                    0,0.8,0.30,0.52,0.18, 0,2,0,1, 1,2,2,2,1,1
                ]);
                var status=wasm.hgr_convert(0x1234);
                if(status!==0) throw new Error("HGR WASM status "+status);
                var indices=new Uint8Array(memory,wasm.hgr_get_palette_ptr(),280*192);
                var luma=new Uint8Array(indices.length);
                for(var p=0;p<indices.length;p++)
                {
                    if(indices[p]>7) throw new Error("Invalid HGR palette index");
                    luma[p]=paletteLuma[indices[p]];
                }
                self.postMessage({requestId:msg.requestId,epoch:msg.epoch,luma:luma.buffer},[luma.buffer]);
            }
            catch(error)
            {
                self.postMessage({requestId:msg.requestId,epoch:msg.epoch,error:String(error && error.message || error)});
            }
        };
    }

    function stopWasmWorker()
    {
        wasmPending=null;
        if(wasmWorker && typeof(wasmWorker.terminate)==="function") wasmWorker.terminate();
        wasmWorker=null;
        if(wasmWorkerURL && typeof(URL)!=="undefined" && URL && typeof(URL.revokeObjectURL)==="function")
            URL.revokeObjectURL(wasmWorkerURL);
        wasmWorkerURL=null;
        wasmError=null;
    }

    function startWasmWorker()
    {
        if(wasmWorker) return wasmWorker;
        if(typeof(Worker)!=="function" || typeof(Blob)!=="function" ||
           typeof(URL)==="undefined" || !URL || typeof(URL.createObjectURL)!=="function")
            throw new Error("WASM HGR conversion requires Blob Worker support");

        var script="("+wasmWorkerMain.toString()+")("+JSON.stringify(WASM_HGR_BASE64)+");";
        wasmWorkerURL=URL.createObjectURL(new Blob([script],{type:"text/javascript"}));
        try { wasmWorker=new Worker(wasmWorkerURL); }
        catch(error)
        {
            URL.revokeObjectURL(wasmWorkerURL);
            wasmWorkerURL=null;
            throw error;
        }
        var worker=wasmWorker;
        worker.onmessage=function(event)
        {
            var msg=event && event.data || {};
            if(worker!==wasmWorker || !wasmPending || wasmPending.id!==msg.requestId) return;
            var pending=wasmPending;
            wasmPending=null;
            if(!hostCameraStream || !wasmEnabled || pending.epoch!==hostCameraEpoch) return;
            if(msg.error || !(msg.luma instanceof ArrayBuffer) || msg.luma.byteLength!==HGR_WIDTH*HGR_HEIGHT)
            {
                wasmError=String(msg.error || "Invalid WASM HGR output");
                if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                    console.warn("Dithertizer WASM conversion failed",wasmError);
            }
            else hostCameraFrame=new Uint8Array(msg.luma);
            updateWasmButton(hostCameraControlID);
        };
        worker.onerror=function(event)
        {
            if(worker!==wasmWorker) return;
            wasmPending=null;
            wasmError=String(event && event.message || "WASM worker failed");
            updateWasmButton(hostCameraControlID);
        };
        return worker;
    }

    function captureHostCameraFrame(epoch)
    {
        if(!hostCameraStream || epoch!==hostCameraEpoch || !hostCameraVideo || !hostCameraContext)
            return false;
        if(wasmEnabled && (wasmPending || wasmError)) return false;

        var sourceW=Number(hostCameraVideo.videoWidth)|0;
        var sourceH=Number(hostCameraVideo.videoHeight)|0;
        if(sourceW<=0 || sourceH<=0) return false;

        // A 4:3 camera view fills the Apple display. HGR's 280 samples are
        // slightly narrower than square pixels, so crop before resampling.
        var cropW=Math.min(sourceW,sourceH*4/3);
        var cropH=Math.min(sourceH,sourceW*3/4);
        hostCameraContext.drawImage(hostCameraVideo,(sourceW-cropW)/2,(sourceH-cropH)/2,
            cropW,cropH,0,0,HGR_WIDTH,HGR_HEIGHT);
        var image=hostCameraContext.getImageData(0,0,HGR_WIDTH,HGR_HEIGHT);
        var rgba=image && image.data;
        if(!rgba || rgba.length < HGR_WIDTH*HGR_HEIGHT*4) return false;

        if(wasmEnabled)
        {
            try
            {
                var worker=startWasmWorker();
                var rgb=new Uint8Array(HGR_WIDTH*HGR_HEIGHT*3);
                for(var p=0,s=0,d=0;p<HGR_WIDTH*HGR_HEIGHT;p++,s+=4)
                {
                    rgb[d++]=rgba[s];
                    rgb[d++]=rgba[s+1];
                    rgb[d++]=rgba[s+2];
                }
                var requestId=++wasmRequestId;
                wasmPending={id:requestId,epoch:epoch};
                worker.postMessage({requestId:requestId,epoch:epoch,rgb:rgb.buffer},[rgb.buffer]);
                return true;
            }
            catch(error)
            {
                wasmPending=null;
                wasmError=String(error && error.message || error);
                updateWasmButton(hostCameraControlID);
                if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                    console.warn("Dithertizer WASM conversion unavailable",error);
                return false;
            }
        }

        // Keep the full luminance range: no palette matching or host dithering.
        // Publish a complete raw frame; adjustments are applied at capture time.
        var next=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);
        for(var p=0,s=0;p<next.length;p++,s+=4)
            next[p]=Math.round((299*rgba[s]+587*rgba[s+1]+114*rgba[s+2])/1000);
        hostCameraFrame=next;
        return true;
    }

    // Apple2IO calls mounted-peripheral cycle hooks once per processing frame.
    // The SYSTEM FPS slider owns that cadence; the camera has no private timer.
    this.cycle=function()
    {
        if(!hostCameraStream) return;
        try { captureHostCameraFrame(hostCameraEpoch); }
        catch(error)
        {
            if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                console.warn("Dithertizer camera frame failed",error);
        }
    };

    async function startHostCameraBridge(stream,epoch)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.createElement)!=="function") return false;

        hostCameraVideo=document.createElement("video");
        hostCameraCanvas=document.createElement("canvas");
        if(!hostCameraVideo || !hostCameraCanvas || typeof(hostCameraCanvas.getContext)!=="function")
            throw new Error("Dithertizer host camera requires video/canvas support");

        hostCameraCanvas.width=HGR_WIDTH;
        hostCameraCanvas.height=HGR_HEIGHT;
        hostCameraContext=hostCameraCanvas.getContext("2d");
        if(!hostCameraContext || typeof(hostCameraContext.drawImage)!=="function" || typeof(hostCameraContext.getImageData)!=="function")
            throw new Error("Dithertizer host camera requires a 2D canvas context");

        hostCameraVideo.autoplay=true;
        hostCameraVideo.muted=true;
        hostCameraVideo.playsInline=true;
        hostCameraVideo.srcObject=stream;
        if(typeof(hostCameraVideo.play)==="function") await hostCameraVideo.play();
        if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;

        await captureHostCameraFrame(epoch);
        return true;
    }

    function stopHostCamera()
    {
        hostCameraEpoch++;
        hostCameraPending=false;
        stopWasmWorker();

        if(hostCameraVideo)
        {
            if(typeof(hostCameraVideo.pause)==="function") hostCameraVideo.pause();
            try { hostCameraVideo.srcObject=null; } catch(e) {}
        }
        hostCameraVideo=null;
        hostCameraCanvas=null;
        hostCameraContext=null;
        hostCameraFrame=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);

        if(hostCameraStream && typeof(hostCameraStream.getTracks)==="function")
        {
            var tracks=hostCameraStream.getTracks();
            for(var i=0;i<tracks.length;i++)
                if(tracks[i] && typeof(tracks[i].stop)==="function") tracks[i].stop();
        }
        hostCameraStream=null;
    }

    function updateCameraButton(controlID)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!=="function") return;
        var button=document.getElementById(controlID+"_camera");
        if(!button) return;
        var active=!!hostCameraStream;
        button.setAttribute("aria-pressed",active ? "true" : "false");
        button.title=active ? "Stop host camera" : "Start host camera";
        var icon=button.querySelector ? button.querySelector("i") : null;
        if(icon && icon.style) icon.style.color=active ? "#0a0" : "";
        var status=document.getElementById(controlID+"_camera_status");
        if(status) status.textContent=active ? "ON" : "OFF";
    }

    function updateWasmButton(controlID)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!=="function") return;
        var button=document.getElementById(controlID+"_wasm");
        if(!button) return;
        button.setAttribute("aria-pressed",wasmEnabled ? "true" : "false");
        button.title=wasmError ? "WASM HGR error: "+wasmError :
            (wasmEnabled ? "Disable WASM HGR conversion" : "Enable WASM HGR conversion");
        var icon=button.querySelector ? button.querySelector("i") : null;
        if(icon && icon.style) icon.style.color=wasmError ? "#a00" : (wasmEnabled ? "#0a0" : "");
        var status=document.getElementById(controlID+"_wasm_status");
        if(status) status.textContent=wasmError ? "ERR" : (wasmEnabled ? "ON" : "OFF");
    }

    this.deviceToolWasmToggle=function(controlID)
    {
        hostCameraControlID=String(controlID || "");
        wasmEnabled=!wasmEnabled;
        stopWasmWorker();
        if(hostCameraStream)
        {
            try { captureHostCameraFrame(hostCameraEpoch); }
            catch(error)
            {
                if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                    console.warn("Dithertizer camera frame failed",error);
            }
        }
        updateWasmButton(hostCameraControlID);
        return wasmEnabled;
    };

    this.deviceToolCameraToggle=async function(controlID)
    {
        controlID=String(controlID || "");
        hostCameraControlID=controlID;
        if(hostCameraStream || hostCameraPending)
        {
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
        if(typeof(navigator)==="undefined" || !navigator || !navigator.mediaDevices || typeof(navigator.mediaDevices.getUserMedia)!=="function")
        {
            updateCameraButton(controlID);
            return false;
        }
        var epoch=++hostCameraEpoch;
        hostCameraPending=true;
        try
        {
            var stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
            if(epoch!==hostCameraEpoch)
            {
                if(stream && typeof(stream.getTracks)==="function")
                    stream.getTracks().forEach(function(track){if(track && typeof(track.stop)==="function") track.stop();});
                return false;
            }
            hostCameraPending=false;
            hostCameraStream=stream;
            await startHostCameraBridge(stream,epoch);
            if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;
            updateCameraButton(controlID);
            return true;
        }
        catch(e)
        {
            if(epoch!==hostCameraEpoch) return false;
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
    };

    this.deviceToolSetting=function(controlID,setting,value)
    {
        var bounds={"brightness":[-100,100],"contrast":[0,200],"gamma":[10,500]};
        if(!Object.prototype.hasOwnProperty.call(bounds,setting)) return false;
        value=uiNumber(value,bounds[setting][0],bounds[setting][1]);
        if(value===null) return false;
        uiState[setting]=value;
        updateLumaLookup();
        uiReadout(String(controlID || ""),setting,value);
        return true;
    };

    this.deviceToolSlotHTML=function(ctx)
    {
        ctx=ctx || {};
        var toolboxID=ctx.toolboxID || ("device_tool_"+ctx.slotID);
        var slotID=ctx.slotID==null ? "?" : String(ctx.slotID);
        var slotN=Number(ctx.slotN);
        var controlID="dither_ctrl_"+slotID;
        var call="apple2plus.hwObj().io.SLOT2obj("+slotN+")";
        var cameraActive=!!hostCameraStream;
        var rowStyle="height:21px;display:flex;align-items:center;gap:4px;";

        function slider(setting,label,min,max)
        {
            return "<label for=\""+controlID+"_"+setting+"\" style=\"width:70px;\">"+label+"</label>"
                +"<input id=\""+controlID+"_"+setting+"\" type=\"range\" min=\""+min+"\" max=\""+max+"\" step=\"1\" value=\""+uiState[setting]+"\" title=\""+label+"\" oninput=\""+call+".deviceToolSetting('"+controlID+"','"+setting+"',this.value)\" style=\"width:110px;height:15px;padding:0;margin:0;\">"
                +"<span id=\""+controlID+"_"+setting+"_value\" style=\"width:38px;font:10px monospace;text-align:right;\">"+uiValue(setting,uiState[setting])+"</span>";
        }

        return "<div class=toolbox id=\""+toolboxID+"\" hidden>"
            +"<div class=appbox style=\"box-sizing:border-box;text-align:left;height:76px;padding:3px 6px;display:flex;flex-direction:column;gap:2px;font-size:11px;white-space:nowrap;\">"
            +"<div data-dither-row=\"IMG\" style=\""+rowStyle+"\">"+slider("brightness","Brightness",-100,100)
            +"<button id=\""+controlID+"_camera\" class=\"appbut skinny\" type=\"button\" aria-pressed=\""+(cameraActive ? "true" : "false")+"\" title=\""+(cameraActive ? "Stop host camera" : "Start host camera")+"\" onclick=\""+call+".deviceToolCameraToggle('"+controlID+"')\" style=\"margin-left:auto;height:19px;padding:1px 5px;\"><i class=\"fa fa-camera\" style=\""+(cameraActive ? "color:#0a0;" : "")+"\"></i></button>"
            +"<span id=\""+controlID+"_camera_status\" style=\"width:20px;font-size:10px;text-align:center;color:#777;\">"+(cameraActive ? "ON" : "OFF")+"</span></div>"
            +"<div data-dither-row=\"CONTRAST\" style=\""+rowStyle+"\">"+slider("contrast","Contrast",0,200)
            +"<button id=\""+controlID+"_wasm\" class=\"appbut skinny\" type=\"button\" aria-pressed=\""+(wasmEnabled ? "true" : "false")+"\" title=\""+(wasmError ? "WASM HGR conversion unavailable" : (wasmEnabled ? "Disable WASM HGR conversion" : "Enable WASM HGR conversion"))+"\" onclick=\""+call+".deviceToolWasmToggle('"+controlID+"')\" style=\"margin-left:auto;height:19px;padding:1px 5px;\"><i class=\"fa fa-microchip\" style=\""+(wasmError ? "color:#a00;" : (wasmEnabled ? "color:#0a0;" : ""))+"\"></i></button>"
            +"<span id=\""+controlID+"_wasm_status\" style=\"width:20px;font-size:10px;text-align:center;color:#777;\">"+(wasmError ? "ERR" : (wasmEnabled ? "ON" : "OFF"))+"</span></div>"
            +"<div data-dither-row=\"GAMMA\" style=\""+rowStyle+"\">"+slider("gamma","Gamma",10,500)+"</div>"
            +"</div></div>";
    };

    this.action={"SlotIO":{"RD":{"callback":function(addr,ctx){return card.readSlotIO(addr,ctx);}},"WR":{"callback":function(addr,d8,ctx){return card.writeSlotIO(addr,d8,ctx);}}}};

    this.reset=function()
    {
        stopHostCamera();
        if(hostCameraControlID) updateCameraButton(hostCameraControlID);
        if(hostCameraControlID) updateWasmButton(hostCameraControlID);
        card.state.threshold=0;
        card.state.captureEnabled=false;
        card.state.page2=false;
    };
    this.restart=this.reset;
}

if(typeof(oEMU)==="undefined")
    var oEMU={"component":{"IO":{}}};
else
{
    if(!oEMU.component) oEMU.component={};
    if(!oEMU.component.IO) oEMU.component.IO={};
}
oEMU.component.IO.DithertizerII=new DithertizerII();
