//
// camera_image_input.js
//
// Camera and local-image capture helper for Apple II 280×192 experiments.
// This module owns only:
//   - local image loading via <input type="file">
//   - camera start/stop/capture at a target HGR input size
//   - preview drawing to the visible photo canvas
//   - callback delivery of ImageData to the main experiment
//
// It deliberately does not know about dithering, HGR packing, GPU kernels,
// Apple II memory, or NTSC/waveform rendering.
//

(function(global)
{
  "use strict";

  const CameraImageInput = {
    _cfg: null,
    _cameraStream: null,
    _cameraTimer: null,
    _cameraBusy: false,
    _cameraFrameCount: 0,
    _cameraSourceCanvas: null,
    _cameraSourceCtx: null,

    init: function(options)
    {
      this._cfg = Object.assign({
        hgrWidth: 280,
        hgrHeight: 192,
        cameraFps: 10,
        photoCanvasId: "photo",
        imageUploadId: "imageUpload",
        cameraToggleId: "cameraToggle",
        cameraVideoId: "cameraVideo",
        setStatus: function(msg) { console.log(msg); },
        onFrame: function(imageData, meta) {}
      }, options || {});

      const imageUpload = document.getElementById(this._cfg.imageUploadId);
      const cameraToggle = document.getElementById(this._cfg.cameraToggleId);

      if (imageUpload)
      {
        imageUpload.addEventListener("change", async (event) =>
        {
          const file = event.target.files && event.target.files[0];
          if (!file) return;

          this.stopCamera(false);

          const objectUrl = URL.createObjectURL(file);
          try
          {
            this._cfg.setStatus("Loading local image at " + this._cfg.hgrWidth + "×" + this._cfg.hgrHeight + "...");
            const imageData = await this.loadImageToCanvas(objectUrl);
            this._emitFrame(imageData, {
              source: "image",
              frameCount: 1,
              width: this._cfg.hgrWidth,
              height: this._cfg.hgrHeight
            });
          }
          catch (e)
          {
            console.error(e);
            this._cfg.setStatus("Image input failed; see console.");
          }
          finally
          {
            setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
          }
        });
      }

      if (cameraToggle)
      {
        cameraToggle.addEventListener("click", () =>
        {
          if (this._cameraStream) this.stopCamera(true);
          else this.startCamera();
        });
      }
    },

    loadImageToCanvas: function(imageSrc)
    {
      return new Promise((resolve, reject) =>
      {
        const displayCanvas = document.getElementById(this._cfg.photoCanvasId);
        if (!displayCanvas)
        {
          reject(new Error("Canvas not found: " + this._cfg.photoCanvasId));
          return;
        }

        const displayCtx = displayCanvas.getContext("2d");
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = this._cfg.hgrWidth;
        sourceCanvas.height = this._cfg.hgrHeight;

        const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
        const img = new Image();

        try { img.crossOrigin = "anonymous"; } catch (e) {}

        img.onload = () =>
        {
          // Visible 2× preview.
          displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
          displayCtx.imageSmoothingEnabled = false;
          displayCtx.drawImage(img, 0, 0, displayCanvas.width, displayCanvas.height);

          // Exact Apple II HGR input resolution.
          sourceCtx.clearRect(0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight);
          sourceCtx.imageSmoothingEnabled = false;
          sourceCtx.drawImage(img, 0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight);

          resolve(sourceCtx.getImageData(0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight));
        };

        img.onerror = function()
        {
          reject(new Error("Could not load image: " + imageSrc));
        };

        img.src = imageSrc;
      });
    },

    startCamera: async function()
    {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      {
        this._cfg.setStatus("Camera API is unavailable in this browser/context.");
        return;
      }

      try
      {
        this._cfg.setStatus("Requesting camera permission...");
        this._cameraStream = await this._openCameraStream();

        const video = document.getElementById(this._cfg.cameraVideoId);
        video.srcObject = this._cameraStream;
        await video.play();

        this._cameraFrameCount = 0;

        const button = document.getElementById(this._cfg.cameraToggleId);
        if (button) button.textContent = "Stop camera";

        const track = this._cameraStream.getVideoTracks()[0];
        const settings = track && track.getSettings ? track.getSettings() : {};
        const captureLabel = settings.width && settings.height
          ? ("camera capture " + settings.width + "×" + settings.height + ", resampled to " + this._cfg.hgrWidth + "×" + this._cfg.hgrHeight)
          : ("camera frames resampled to " + this._cfg.hgrWidth + "×" + this._cfg.hgrHeight);

        this._cfg.setStatus("Camera running at about " + this._cfg.cameraFps + " fps; " + captureLabel + ".");

        this.captureCameraFrame();
        this._cameraTimer = window.setInterval(
          () => this.captureCameraFrame(),
          Math.round(1000 / this._cfg.cameraFps)
        );
      }
      catch (e)
      {
        console.error(e);
        this.stopCamera(false);
        this._cfg.setStatus("Could not start camera. Check browser permission and local-file camera policy.");
      }
    },

    _openCameraStream: async function()
    {
      const exactConstraints = {
        video: {
          width:  { exact: this._cfg.hgrWidth },
          height: { exact: this._cfg.hgrHeight },
          frameRate: { ideal: this._cfg.cameraFps, max: this._cfg.cameraFps }
        },
        audio: false
      };

      const fallbackConstraints = {
        video: {
          width:  { ideal: this._cfg.hgrWidth },
          height: { ideal: this._cfg.hgrHeight },
          aspectRatio: { ideal: this._cfg.hgrWidth / this._cfg.hgrHeight },
          frameRate: { ideal: this._cfg.cameraFps, max: this._cfg.cameraFps }
        },
        audio: false
      };

      try
      {
        return await navigator.mediaDevices.getUserMedia(exactConstraints);
      }
      catch (e)
      {
        console.warn("Exact " + this._cfg.hgrWidth + "×" + this._cfg.hgrHeight + " camera mode unavailable; falling back to ideal constraints.", e);
        return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
    },

    stopCamera: function(showStatus)
    {
      if (this._cameraTimer)
      {
        window.clearInterval(this._cameraTimer);
        this._cameraTimer = null;
      }

      const video = document.getElementById(this._cfg.cameraVideoId);
      if (video) video.pause();

      if (this._cameraStream)
      {
        this._cameraStream.getTracks().forEach(function(track) { track.stop(); });
        this._cameraStream = null;
      }

      this._cameraBusy = false;

      const button = document.getElementById(this._cfg.cameraToggleId);
      if (button) button.textContent = "Start camera 280×192 @ 10 fps";

      if (showStatus) this._cfg.setStatus("Camera stopped.");
    },

    captureCameraFrame: function()
    {
      if (!this._cameraStream || this._cameraBusy) return;

      const video = document.getElementById(this._cfg.cameraVideoId);
      const displayCanvas = document.getElementById(this._cfg.photoCanvasId);
      if (!video || !displayCanvas || video.readyState < 2) return;

      this._cameraBusy = true;

      try
      {
        if (!this._cameraSourceCanvas)
        {
          this._cameraSourceCanvas = document.createElement("canvas");
          this._cameraSourceCanvas.width = this._cfg.hgrWidth;
          this._cameraSourceCanvas.height = this._cfg.hgrHeight;
          this._cameraSourceCtx = this._cameraSourceCanvas.getContext("2d", { willReadFrequently: true });
        }

        const displayCtx = displayCanvas.getContext("2d");
        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.imageSmoothingEnabled = false;
        displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);

        this._cameraSourceCtx.clearRect(0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight);
        this._cameraSourceCtx.imageSmoothingEnabled = false;
        this._cameraSourceCtx.drawImage(video, 0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight);

        const imageData = this._cameraSourceCtx.getImageData(0, 0, this._cfg.hgrWidth, this._cfg.hgrHeight);

        this._cameraFrameCount++;
        this._emitFrame(imageData, {
          source: "camera",
          frameCount: this._cameraFrameCount,
          width: this._cfg.hgrWidth,
          height: this._cfg.hgrHeight
        });
      }
      catch (e)
      {
        console.error(e);
        this._cfg.setStatus("Camera frame processing failed; see console.");
      }
      finally
      {
        this._cameraBusy = false;
      }
    },

    _emitFrame: function(imageData, meta)
    {
      this._cfg.onFrame(imageData, meta || {});

      if (meta && meta.source === "camera" && (meta.frameCount % this._cfg.cameraFps) === 0)
      {
        this._cfg.setStatus(
          "Camera running: " + meta.frameCount +
          " frames captured at " + this._cfg.hgrWidth + "×" + this._cfg.hgrHeight +
          ". GPU/HGR processing is intentionally disabled in Step A."
        );
      }
    }
  };

  global.CameraImageInput = CameraImageInput;
})(window);







function processInputImageData(imageData, meta)
{
  // Step A intentionally stops here.
  // Step B/C can replace this callback with:
  //   1) image → HGR memory packing, or
  //   2) image → color HGR approximation, or
  //   3) direct test-pattern writes into HGR RAM before waveform rendering.
  const source = meta && meta.source ? meta.source : "input";
  const frameInfo = meta && meta.frameCount ? (" frame " + meta.frameCount) : "";

  apple2plus.vidObj().markDirty();

  if (source !== "camera" || (meta.frameCount % CAMERA_FPS) === 1)
  {
    setStatus(
      "Captured " + source + frameInfo + " at " +
      imageData.width + "×" + imageData.height +
      ". Step A does not dither or write HGR RAM yet."
    );
  }
}




