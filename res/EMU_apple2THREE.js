//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2THREE.js
//
// First-phase Apple II 3D monitor renderer for RetroAppleJS.
//
// Principle:
// - keep an existing compatible Apple2Video renderer as the 2D producer;
// - render that producer into a hidden 560x384 source canvas;
// - copy/fit that source canvas into a second hidden 560x384 texture canvas;
// - expose the texture canvas as a THREE.CanvasTexture;
// - assign the texture to the 3D monitor screen material's map + emissiveMap;
// - update the texture at a throttled rate, initially 10fps.
//
// v5 changes:
// - keeps the v4 OrbitControls camera binding fix;
// - keeps the separate THREE_scene include model;
// - splits the Apple II source canvas from the Three texture canvas;
// - adds configurable texture padding/fit compensation for screen-mesh UV overscan.
//
//
// Optional configuration before loading this file:
//
//   window.Apple2VideoTHREE_CONFIG = {
//       textureFPS: 10,
//       renderFPS: 30,
//       msaaSamples: 0,
//       orbitControls: true,
//       emissiveColor: 0xFFFFFF,
//       emissiveIntensity: 1,
//
//       textureFlipY: false,
//       textureMirrorX: false,
//       textureMirrorY: false,
//
//       // v5 default compensation, based on the observed truncation:
//       // ~14 canvas px left/right and ~16 canvas px top/bottom.
//       texturePadLeft: 14,
//       texturePadTop: 16,
//       texturePadRight: 14,
//       texturePadBottom: 16,
//       texturePadColor: "#000000",
//       textureSmoothing: false,
//
//       eventShield: false,
//       eventShieldPreventDefault: false,
//       showGrid: false,
//       showAxes: false,
//       background: 0x202020,
//       cameraAspectMul: 1
//   };
//
"use strict";

// Explicit dependency: THREE uses the GPU renderer as its hidden 2D producer.
// index.html defines Apple2VideoGPU before loading this file.
var Apple2VideoTHREE_2D = typeof(Apple2VideoGPU) == "function" ? Apple2VideoGPU : null;

var APPLE2_THREE_CFG_DEFAULT = 
{
        textureFPS: 10,
        renderFPS: 50,
        msaaSamples: 0,
        orbitControls: false,

        fixedCameraLookAt: true,
        fixedCameraTargetX: 0,
        fixedCameraTargetY: 0,
        fixedCameraTargetZ: 0,

        emissiveColor: 0xFFFFFF,
        emissiveIntensity: 1,

        // Final orientation from v3/v4.
        textureFlipY: false,
        textureMirrorX: false,
        textureMirrorY: false,

        // v5 overscan/UV compensation.  These are canvas pixels, not Apple II pixels.
        // The defaults correspond to roughly 7 Apple II pixels horizontally and
        // 8 Apple II pixels vertically on the doubled 560x384 canvas.
        texturePadLeft: 14,
        texturePadTop: 64,
        texturePadRight: 14,
        texturePadBottom: 64,
        texturePadColor: "#000000",
        textureSmoothing: false,

        eventShield: false,
        eventShieldPreventDefault: false,

        showGrid: false,
        showAxes: false,
        background: 0x000000, // frame background
        cameraAspectMul: 1
    };

    function Apple2VideoTHREE_copyConfig()
    {
        var cfg = {}, user = window.Apple2VideoTHREE_CONFIG || {};
        for (var k in APPLE2_THREE_CFG_DEFAULT) cfg[k] = APPLE2_THREE_CFG_DEFAULT[k];
        for (var u in user) cfg[u] = user[u];
        return cfg;
    }

    function Apple2VideoTHREE_clampInt(v, lo, hi)
    {
        v = Number(v);
        if (!isFinite(v)) v = 0;
        v = Math.round(v);
        if (v < lo) return lo;
        if (v > hi) return hi;
        return v;
    }

    function Apple2VideoTHREE_getEmbeddedProjectScene()
    {
        // Important: a top-level `const THREE_scene = ...` in a non-module
        // browser script is not necessarily a property of window.  Therefore
        // check the lexical global first, then fall back to window.THREE_scene.
        try
        {
            if (typeof(THREE_scene) !== "undefined")
                return THREE_scene;
        }
        catch(e) {}

        if (window.THREE_scene !== undefined)
            return window.THREE_scene;

        return null;
    }

    function Apple2VideoTHREE_getControlInstance()
     {
        if (typeof(oApple2Video) === "undefined" || oApple2Video === null ||
            typeof(oApple2Video.getRendererInstance) !== "function")
            return null;

        return oApple2Video.getRendererInstance("threejs", true);
    }

    function Apple2VideoTHREE_setPerspectiveControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setPerspective) !== "function") return;

        var value = renderer3D.setPerspective(input.value);
        input.value = value;

        var output = document.getElementById("threePerspectiveValue");
        if (output) output.textContent = value + "°";
    }

    function Apple2VideoTHREE_setLuminosityControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setEmissiveIntensity) !== "function") return;

        var value = renderer3D.setEmissiveIntensity(Number(input.value) / 100);
        input.value = Math.round(value * 100);

        var output = document.getElementById("threeLuminosityValue");
        if (output) output.textContent = value.toFixed(2);
    }

    function Apple2VideoTHREE_setOrbitControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setOrbitEnabled) !== "function") return;

        input.checked = renderer3D.setOrbitEnabled(input.checked);
    }

    function Apple2VideoTHREE_setMSAAControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setMSAASamples) !== "function") return;

        var info = renderer3D.setMSAASamples(input.value);
        input.max = Math.max(0, info.maxSamples);
        input.value = info.samples;
        input.disabled = info.maxSamples <= 0;

        var output = document.getElementById("threeMSAAValue");
        if (output) output.textContent = info.samples + " / " + info.maxSamples;
    }

    function Apple2VideoTHREE_controls(renderer3D)
    {
        var fov = renderer3D && typeof(renderer3D.getPerspective) === "function"
            ? renderer3D.getPerspective()
            : 50;
        var luminosity = renderer3D && typeof(renderer3D.getEmissiveIntensity) === "function"
            ? renderer3D.getEmissiveIntensity()
            : 1;
        var orbit = renderer3D && typeof(renderer3D.getOrbitEnabled) === "function"
            ? renderer3D.getOrbitEnabled()
            : !!APPLE2_THREE_CFG_DEFAULT.orbitControls;
        var msaa = renderer3D && typeof(renderer3D.getMSAAInfo) === "function"
            ? renderer3D.getMSAAInfo()
            : {"samples":APPLE2_THREE_CFG_DEFAULT.msaaSamples, "maxSamples":8};
        var msaaMax = Math.max(0, msaa.maxSamples | 0);

        return "<div class=\"appbut mini\">"
            +"<input id=\"threePerspective\" type=\"range\" min=\"10\" max=\"120\" step=\"1\" value=\""+Math.round(fov)+"\" class=\"slider\""
            +" oninput=\"Apple2VideoTHREE_setPerspectiveControl(this)\" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">perspective "
            +"<span id=\"threePerspectiveValue\">"+Math.round(fov)+"°</span></div>"
            +"</div><br>"
            
            +"<div class=\"appbut mini\">"
            +"<input id=\"threeLuminosity\" type=\"range\" min=\"0\" max=\"300\" step=\"5\" value=\""+Math.round(luminosity*100)+"\" class=\"slider\""
            +" oninput=\"Apple2VideoTHREE_setLuminosityControl(this)\" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">luminosity "
            +"<span id=\"threeLuminosityValue\">"+Number(luminosity).toFixed(2)+"</span></div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeOrbit\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setOrbitControl(this)\""
            +(orbit ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">orbit camera</div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeMSAA\" type=\"range\" min=\"0\" max=\""+msaaMax+"\" step=\"1\" value=\""+Math.min(msaa.samples|0,msaaMax)+"\" class=\"slider\""
            +" onchange=\"Apple2VideoTHREE_setMSAAControl(this)\""
            +(msaaMax <= 0 ? " disabled" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">MSAA samples "
            +"<span id=\"threeMSAAValue\">"+Math.min(msaa.samples|0,msaaMax)+" / "+msaaMax+"</span></div>"
            +"</div>";
    }

    function Apple2VideoTHREE(canvas)
    {
        const DISPLAY_W = 560;
        const DISPLAY_H = 384;

        var video3D = this;
        var cfg = Apple2VideoTHREE_copyConfig();

        var renderLoopStarted = false;
        var resizeListenerInstalled = false;
        var lastTextureUpdate = 0;
        var lastRenderUpdate = 0;
        var sceneLoadStarted = false;

        this.id = "THREE";
        this.ctx = canvas || null;            // For Apple2Plus this is the visible canvas.
        this.canvas = canvas || null;
        this.vidram = null;                  // Apple2Hw assigns this after construction.
        this.hw = null;

        this.video2D = null;                 // Previous renderer, usually EMU_apple2GPU.js.
        this.serial8 = new Uint8Array();

        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.controlsCamera = null;
        this.screenMesh = null;
        this.screenTexture = null;

        this.msaaRenderTarget = null;
        this.msaaCopyScene = null;
        this.msaaCopyCamera = null;
        this.msaaCopyQuad = null;

        this.textureDirty = true;
        this.ready = false;
        this._eventShieldInstalled = false;

        // v5: source canvas receives the Apple II GPU.js output.
        this.videoCanvas = document.createElement("canvas");
        this.videoCanvas.width = DISPLAY_W;
        this.videoCanvas.height = DISPLAY_H;
        this.videoCanvas.style.width = DISPLAY_W + "px";
        this.videoCanvas.style.height = DISPLAY_H + "px";
        this.videoCanvas.style.display = "none";

        // v5: texture canvas is what Three.js uploads.  We copy the source canvas
        // into this canvas with optional padding/fit compensation.
        this.textureCanvas = document.createElement("canvas");
        this.textureCanvas.width = DISPLAY_W;
        this.textureCanvas.height = DISPLAY_H;
        this.textureCanvas.style.width = DISPLAY_W + "px";
        this.textureCanvas.style.height = DISPLAY_H + "px";
        this.textureCanvas.style.display = "none";
        this.textureCtx = this.textureCanvas.getContext("2d", {alpha:false});

        // Apple2Plus uses this test:
        //   new Apple2Video().initGPU === undefined ? pass 2D context : pass canvas
        // So this driver intentionally exposes initGPU, even though Three.js is not GPU.js.
        this.initGPU = function()
        {
            return true;
        };

        this.ensure2DRenderer = function()
        {
            if (this.video2D) return true;
            if (typeof(Apple2VideoTHREE_2D) !== "function" || Apple2VideoTHREE_2D === Apple2VideoTHREE)
            {
                console.warn("Apple2VideoTHREE: Apple2VideoGPU is unavailable. Load EMU_apple2GPU.js before EMU_apple2THREE.js.");
                return false;
            }

            this.video2D = new Apple2VideoTHREE_2D(this.videoCanvas);
            this.video2D.vidram = this.vidram;
            this.video2D.hw = this.hw;

            return true;
        };

        this.sync2DLinks = function()
        {
            if (!this.video2D) return;

            this.video2D.vidram = this.vidram;
            this.video2D.hw = this.hw;

            // Expose the 2D renderer's
            // serial buffer and delegate kernel calls back to it.
            if (this.video2D.serial8)
                this.serial8 = this.video2D.serial8;

            this.kernel = function(mem, rom, serial8)
            {
                if (!video3D.video2D || typeof(video3D.video2D.kernel) !== "function") return;

                var r = video3D.video2D.kernel(mem, rom, serial8);
                video3D.textureDirty = true;
                return r;
            };
        };

        this.kernel = function()
        {
            console.warn("Apple2VideoTHREE: 2D kernel is not initialised yet.");
        };

        this.reset = function()
        {
            this.textureDirty = true;
            if (this.ensure2DRenderer())
            {
                this.video2D.reset();
                this.sync2DLinks();
            }
            this.ensureTHREE();
        };

        this.cycle = function()
        {
            if (this.video2D && typeof(this.video2D.cycle) === "function")
            {
                this.video2D.cycle();

                // Since EMU_apple2GPU.js now calls its own kernel directly,
                // Apple2VideoTHREE no longer sees the kernel call.
                // Keep the Three texture upload loop alive while this renderer is active.
                this.textureDirty = true;
            }
        };

        this.redraw = function()
        {
            if (this.video2D && typeof(this.video2D.redraw) === "function")
                this.video2D.redraw();
            this.textureDirty = true;
        };

        this.write = function(addr, d8)
        {
            if (this.video2D && typeof(this.video2D.write) === "function")
            {
                this.video2D.vidram = this.vidram;
                this.video2D.hw = this.hw;
                this.video2D.write(addr, d8);
                this.textureDirty = true;
            }
        };

        this.setGfx = function(flag)
        {
            if (this.video2D && typeof(this.video2D.setGfx) === "function")
                this.video2D.setGfx(flag);
            this.sync2DLinks();
        };

        this.setMix = function(flag)
        {
            if (this.video2D && typeof(this.video2D.setMix) === "function")
                this.video2D.setMix(flag);
            this.sync2DLinks();
        };

        this.setPage2 = function(flag)
        {
            if (this.video2D && typeof(this.video2D.setPage2) === "function")
                this.video2D.setPage2(flag);
            this.sync2DLinks();
        };

        this.setHires = function(flag)
        {
            if (this.video2D && typeof(this.video2D.setHires) === "function")
                this.video2D.setHires(flag);
            this.sync2DLinks();
        };

        this.setMonitor = function(mode)
        {
            var ret = {"color":"#000000", "name":"THREE"};

            if (this.video2D && typeof(this.video2D.setMonitor) === "function")
                ret = this.video2D.setMonitor(mode);

            this.sync2DLinks();
            this.textureDirty = true;
            return ret;
        };

        this.getChromeMode = function()
        {
            if (this.video2D && typeof(this.video2D.getChromeMode) === "function")
                return this.video2D.getChromeMode();
            return 0;
        };

        this.getloresCols = function()
        {
            if (this.video2D && typeof(this.video2D.getloresCols) === "function")
                return this.video2D.getloresCols();
            return [];
        };

        this.gethiresCols = function()
        {
            if (this.video2D && typeof(this.video2D.gethiresCols) === "function")
                return this.video2D.gethiresCols();
            return [];
        };

        this.setCol = function(idx, column, val)
        {
            if (this.video2D && typeof(this.video2D.setCol) === "function")
            {
                var ret = this.video2D.setCol(idx, column, val);
                this.textureDirty = true;
                return ret;
            }
            return val;
        };

        this.addrVisible = function(addr)
        {
            if (this.video2D && typeof(this.video2D.addrVisible) === "function")
                return this.video2D.addrVisible(addr);
            return true;
        };

        this.ensureTHREE = function()
        {
            if (this.renderer)
                return true;

            if (typeof(THREE) === "undefined")
            {
                console.warn("Apple2VideoTHREE: THREE is not loaded. Add three.min.js before EMU_apple2THREE.js.");
                return false;
            }

            if (!this.canvas)
            {
                console.warn("Apple2VideoTHREE: no visible canvas was supplied.");
                return false;
            }

            this.prepareVisibleCanvas();

            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false
            });

            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this.resizeRenderer();
            this.setMSAASamples(cfg.msaaSamples);

            this.screenTexture = new THREE.CanvasTexture(this.textureCanvas);
            this.configureScreenTexture();
            this.updateTextureCanvas();

            this.buildFallbackScene();
            this.loadProjectScene();
            this.installResizeListener();
            this.startRenderLoop();

            return true;
        };

        this.prepareVisibleCanvas = function()
        {
            if (!this.canvas) return;

            if (!this.canvas.width)  this.canvas.width = DISPLAY_W;
            if (!this.canvas.height) this.canvas.height = DISPLAY_H;

            if (this.canvas.style)
            {
                if (!this.canvas.style.width)  this.canvas.style.width = DISPLAY_W + "px";
                if (!this.canvas.style.height) this.canvas.style.height = DISPLAY_H + "px";
                this.canvas.style.display = "block";
                this.canvas.style.background = "#000";
                this.canvas.style.pointerEvents = "auto";
                this.canvas.style.touchAction = "none";
                this.canvas.style.userSelect = "none";
            }
        };

        this.resizeRenderer = function()
        {
            if (!this.renderer || !this.canvas) return;

            var w = this.canvas.clientWidth  || this.canvas.width  || DISPLAY_W;
            var h = this.canvas.clientHeight || this.canvas.height || DISPLAY_H;

            this.renderer.setSize(w, h, false);

            if (this.camera && this.camera.isPerspectiveCamera)
            {
                this.camera.aspect = (w * cfg.cameraAspectMul) / h;
                this.camera.updateProjectionMatrix();
            }

            this.resizeMSAATarget();
        };

        this.configureRendererFromProject = function(project)
        {
            if (!this.renderer || !project) return;

            this.renderer.shadowMap.enabled = Boolean(project.shadows);
            this.renderer.shadowMap.type = (project.shadowType === 1) ?
                THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

            this.renderer.toneMapping = (project.toneMapping === 1) ? THREE.ReinhardToneMapping :
                                        (project.toneMapping === 2) ? THREE.CineonToneMapping :
                                        (project.toneMapping === 3) ? THREE.ACESFilmicToneMapping :
                                                                     THREE.LinearToneMapping;

            this.renderer.toneMappingExposure = project.toneMappingExposure || 1;
        };

        this.getPerspective = function()
        {
            return this.camera && this.camera.isPerspectiveCamera ? this.camera.fov : 50;
        };

        this.setPerspective = function(fov)
        {
            fov = Number(fov);
            if (!isFinite(fov)) fov = this.getPerspective();
            fov = Math.max(10, Math.min(120, fov));

            if (!this.camera)
                this.ensureTHREE();

            if (this.camera && this.camera.isPerspectiveCamera)
            {
                this.camera.fov = fov;
                this.camera.updateProjectionMatrix();
            }

            return fov;
        };

        this.getEmissiveIntensity = function()
        {
            return Number(cfg.emissiveIntensity) || 0;
        };

        this.setEmissiveIntensity = function(intensity)
        {
            intensity = Number(intensity);
            if (!isFinite(intensity)) intensity = this.getEmissiveIntensity();
            intensity = Math.max(0, Math.min(5, intensity));
            cfg.emissiveIntensity = intensity;

            if (!this.scene)
                this.ensureTHREE();

            var screen = this.screenMesh || this.findScreenMesh();
            if (screen)
            {
                var materials = Array.isArray(screen.material) ? screen.material : [screen.material];
                for (var i=0;i<materials.length;i++)
                {
                    var material = materials[i];
                    if (!material || material.emissive === undefined) continue;
                    material.emissiveIntensity = intensity;
                    material.needsUpdate = true;
                }
            }

            return intensity;
        };

        this.getMaxSamples = function()
        {
            return this.renderer && this.renderer.capabilities
                ? Math.max(0, this.renderer.capabilities.maxSamples | 0)
                : 0;
        };

        this.disposeMSAATarget = function()
        {
            if (this.msaaRenderTarget)
                this.msaaRenderTarget.dispose();

            if (this.msaaCopyQuad)
            {
                if (this.msaaCopyQuad.geometry)
                    this.msaaCopyQuad.geometry.dispose();
                if (this.msaaCopyQuad.material)
                    this.msaaCopyQuad.material.dispose();
            }

            this.msaaRenderTarget = null;
            this.msaaCopyScene = null;
            this.msaaCopyCamera = null;
            this.msaaCopyQuad = null;
        };

        this.rebuildMSAATarget = function()
        {
            this.disposeMSAATarget();

            if (!this.renderer || cfg.msaaSamples <= 0)
                return;

            var size = new THREE.Vector2();
            this.renderer.getDrawingBufferSize(size);

            this.msaaRenderTarget = new THREE.WebGLRenderTarget(
                Math.max(1,size.x),
                Math.max(1,size.y),
                {
                     "depthBuffer":true
                    ,"stencilBuffer":false
                    ,"samples":cfg.msaaSamples
                }
            );

            this.msaaCopyCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
            this.msaaCopyCamera.position.z = 1;
            this.msaaCopyScene = new THREE.Scene();

            var material = new THREE.MeshBasicMaterial({
                 "map":this.msaaRenderTarget.texture
                ,"depthTest":false
                ,"depthWrite":false
            });
            material.toneMapped = false;

            this.msaaCopyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
            this.msaaCopyScene.add(this.msaaCopyQuad);
        };

        this.resizeMSAATarget = function()
        {
            if (!this.renderer || !this.msaaRenderTarget) return;

            var size = new THREE.Vector2();
            this.renderer.getDrawingBufferSize(size);
            this.msaaRenderTarget.setSize(Math.max(1,size.x),Math.max(1,size.y));
        };

        this.getMSAAInfo = function()
        {
            return {
                 "samples":Math.max(0,cfg.msaaSamples|0)
                ,"maxSamples":this.getMaxSamples()
            };
        };

        this.setMSAASamples = function(samples)
        {
            var maxSamples = this.getMaxSamples();
            samples = Apple2VideoTHREE_clampInt(samples,0,maxSamples);
            cfg.msaaSamples = samples;
            this.rebuildMSAATarget();
            return this.getMSAAInfo();
        };

        this.renderTHREEScene = function()
        {
            if (!this.renderer || !this.scene || !this.camera) return;

            if (this.msaaRenderTarget && cfg.msaaSamples > 0)
            {
                this.renderer.setRenderTarget(this.msaaRenderTarget);
                this.renderer.render(this.scene,this.camera);
                this.renderer.setRenderTarget(null);
                this.renderer.render(this.msaaCopyScene,this.msaaCopyCamera);
            }
            else
            {
                this.renderer.setRenderTarget(null);
                this.renderer.render(this.scene,this.camera);
            }
        };



        this.configureScreenTexture = function()
        {
            if (!this.screenTexture) return;

            this.screenTexture.flipY = !!cfg.textureFlipY;
            this.screenTexture.wrapS = THREE.ClampToEdgeWrapping;
            this.screenTexture.wrapT = THREE.ClampToEdgeWrapping;
            this.screenTexture.minFilter = THREE.LinearFilter;
            this.screenTexture.magFilter = THREE.NearestFilter;
            this.screenTexture.generateMipmaps = false;
            this.screenTexture.needsUpdate = true;

            if (THREE.SRGBColorSpace !== undefined)
                this.screenTexture.colorSpace = THREE.SRGBColorSpace;
            else if (THREE.sRGBEncoding !== undefined)
                this.screenTexture.encoding = THREE.sRGBEncoding;

            this.applyTextureMirror();
            this.screenTexture.needsUpdate = true;
        };

        this.applyTextureMirror = function()
        {
            if (!this.screenTexture) return;

            this.screenTexture.repeat.set(
                cfg.textureMirrorX ? -1 : 1,
                cfg.textureMirrorY ? -1 : 1
            );

            this.screenTexture.offset.set(
                cfg.textureMirrorX ? 1 : 0,
                cfg.textureMirrorY ? 1 : 0
            );
        };

        this.setTextureOrientation = function(flipY, mirrorX, mirrorY)
        {
            cfg.textureFlipY = !!flipY;
            cfg.textureMirrorX = !!mirrorX;
            cfg.textureMirrorY = !!mirrorY;
            this.configureScreenTexture();
            this.textureDirty = true;
            return this.getTextureOrientation();
        };

        this.getTextureOrientation = function()
        {
            return {
                textureFlipY: cfg.textureFlipY,
                textureMirrorX: cfg.textureMirrorX,
                textureMirrorY: cfg.textureMirrorY
            };
        };

        this.setTexturePadding = function(left, top, right, bottom)
        {
            if (typeof(left) === "object" && left !== null)
            {
                var p = left;
                left = p.left;
                top = p.top;
                right = p.right;
                bottom = p.bottom;
            }
            cfg.texturePadLeft   = Apple2VideoTHREE_clampInt(left,   0, DISPLAY_W - 1);
            cfg.texturePadTop    = Apple2VideoTHREE_clampInt(top,    0, DISPLAY_H - 1);
            cfg.texturePadRight  = Apple2VideoTHREE_clampInt(right,  0, DISPLAY_W - 1);
            cfg.texturePadBottom = Apple2VideoTHREE_clampInt(bottom, 0, DISPLAY_H - 1);

            this.textureDirty = true;
            return this.getTexturePadding();
        };

        this.getTexturePadding = function()
        {
            return {
                left: cfg.texturePadLeft | 0,
                top: cfg.texturePadTop | 0,
                right: cfg.texturePadRight | 0,
                bottom: cfg.texturePadBottom | 0,
                color: cfg.texturePadColor,
                smoothing: !!cfg.textureSmoothing
            };
        };

        this.updateTextureCanvas = function()
        {
            if (!this.textureCtx || !this.videoCanvas) return;

            var l = Apple2VideoTHREE_clampInt(cfg.texturePadLeft,   0, DISPLAY_W - 1);
            var t = Apple2VideoTHREE_clampInt(cfg.texturePadTop,    0, DISPLAY_H - 1);
            var r = Apple2VideoTHREE_clampInt(cfg.texturePadRight,  0, DISPLAY_W - 1);
            var b = Apple2VideoTHREE_clampInt(cfg.texturePadBottom, 0, DISPLAY_H - 1);

            var dw = DISPLAY_W - l - r;
            var dh = DISPLAY_H - t - b;

            if (dw < 1) dw = 1;
            if (dh < 1) dh = 1;

            var ctx = this.textureCtx;
            ctx.save();
            ctx.imageSmoothingEnabled = !!cfg.textureSmoothing;
            ctx.fillStyle = cfg.texturePadColor || "#000000";
            ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
            ctx.drawImage(this.videoCanvas, 0, 0, DISPLAY_W, DISPLAY_H, l, t, dw, dh);
            ctx.restore();
        };

        this.loadProjectScene = function()
        {
            if (sceneLoadStarted) return;
            sceneLoadStarted = true;

            var json_proj = Apple2VideoTHREE_getEmbeddedProjectScene();
            if (!json_proj)
            {
                console.warn("Apple2VideoTHREE: THREE_scene is not defined; using fallback scene.");
                return;
            }

            this.installProjectScene(json_proj);
        };

        this.installProjectScene = function(json_proj)
        {
            if (!json_proj || !json_proj.scene)
                return;

            this.configureRendererFromProject(json_proj.project);

            var loader = new THREE.ObjectLoader();
            this.scene = loader.parse(json_proj.scene);

            if (this.scene && cfg.background !== null && cfg.background !== undefined)
                this.scene.background = new THREE.Color(cfg.background);

            this.camera = this.cameraFromProject(json_proj.camera);
            this.attachTextureToScreen();

            if (cfg.showGrid)
                this.scene.add(new THREE.GridHelper(200, 20));

            if (cfg.showAxes)
                this.scene.add(new THREE.AxesHelper(60));

            this.installOrbitControls();
            this.resizeRenderer();
            this.ready = true;
        };

        this.cameraFromProject = function(cameraJson)
        {
            if (!cameraJson || !cameraJson.object)
                return this.makeFallbackCamera();

            var c = cameraJson.object;
            var cam = new THREE.PerspectiveCamera(c.fov, c.aspect, c.near, c.far);

            cam.name = c.name || "Camera";
            cam.zoom = c.zoom || 1;
            cam.focus = c.focus || 10;
            cam.filmGauge = c.filmGauge || 35;
            cam.filmOffset = c.filmOffset || 0;

            if (c.matrix)
            {
                var m4 = new THREE.Matrix4().fromArray(c.matrix);
                cam.matrix.copy(m4);
                cam.matrix.decompose(cam.position, cam.quaternion, cam.scale);
            }

            if (c.up) cam.up.fromArray(c.up);
            if (c.layers !== undefined) cam.layers.mask = c.layers;

            if (cfg.fixedCameraLookAt)
            {
                cam.lookAt(
                    cfg.fixedCameraTargetX || 0,
                    cfg.fixedCameraTargetY || 0,
                    cfg.fixedCameraTargetZ || 0
                );
            }

            cam.updateProjectionMatrix();
            cam.updateMatrix();
            cam.updateMatrixWorld(true);

            return cam;
        };

        this.makeFallbackCamera = function()
        {
            var cam = new THREE.PerspectiveCamera(45, DISPLAY_W / DISPLAY_H, 0.01, 1000);
            cam.position.set(0, 0, 3.2);
            cam.lookAt(0, 0, 0);
            return cam;
        };

        this.buildFallbackScene = function()
        {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(cfg.background);
            this.camera = this.makeFallbackCamera();

            var group = new THREE.Group();
            group.name = "Apple II fallback monitor";

            var frameGeo = new THREE.BoxGeometry(3.2, 2.35, 0.18);
            var frameMat = new THREE.MeshStandardMaterial({
                color: 0x303030,
                roughness: 0.85,
                metalness: 0.0
            });
            var frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.z = -0.08;
            group.add(frame);

            var screenGeo = new THREE.PlaneGeometry(2.8, 1.92);
            var screenMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: this.screenTexture,
                emissive: new THREE.Color(cfg.emissiveColor),
                emissiveMap: this.screenTexture,
                emissiveIntensity: cfg.emissiveIntensity,
                roughness: 0.55,
                metalness: 0.0
            });
            var screen = new THREE.Mesh(screenGeo, screenMat);
            screen.name = "screen";
            screen.position.z = 0.02;
            group.add(screen);

            this.screenMesh = screen;
            this.scene.add(group);

            var ambient = new THREE.AmbientLight(0xffffff, 0.55);
            this.scene.add(ambient);

            var light = new THREE.DirectionalLight(0xffffff, 0.65);
            light.position.set(2, 4, 3);
            this.scene.add(light);

            this.installOrbitControls();
            this.ready = true;
        };

        this.findScreenMesh = function()
        {
            if (!this.scene) return null;

            var found = this.scene.getObjectByName("screen");
            if (found && found.isMesh) return found;

            this.scene.traverse(function(obj)
            {
                if (found || !obj.isMesh) return;

                var mat = obj.material;
                if (Array.isArray(mat)) mat = mat[0];

                if (obj.name && obj.name.toLowerCase().indexOf("screen") >= 0)
                    found = obj;
                else if (mat && mat.name && mat.name.toLowerCase().indexOf("screen") >= 0)
                    found = obj;
            });

            return found;
        };

        this.attachTextureToScreen = function()
        {
            var screen = this.findScreenMesh();
            if (!screen)
            {
                console.warn("Apple2VideoTHREE: no mesh named 'screen' found in the scene.");
                return false;
            }

            this.screenMesh = screen;

            var materials = Array.isArray(screen.material) ? screen.material : [screen.material];
            for (var i = 0; i < materials.length; i++)
            {
                var mat = materials[i];
                if (!mat) continue;

                mat.map = this.screenTexture;

                if (mat.emissive !== undefined)
                {
                    mat.emissive = new THREE.Color(cfg.emissiveColor);
                    mat.emissiveMap = this.screenTexture;
                    mat.emissiveIntensity = cfg.emissiveIntensity;
                }

                mat.needsUpdate = true;
            }

            this.textureDirty = true;
            return true;
        };

        this.getOrbitEnabled = function()
        {
            return !!cfg.orbitControls;
        };

        this.setOrbitEnabled = function(flag)
        {
            cfg.orbitControls = !!flag;

            if (!cfg.orbitControls)
            {
                if (this.controls && typeof(this.controls.dispose) === "function")
                    this.controls.dispose();

                this.controls = null;
                this.controlsCamera = null;
                return false;
            }

            if (!this.renderer)
                this.ensureTHREE();

            this.installOrbitControls();
            return !!this.controls;
        };

        this.installOrbitControls = function()
        {
            if (!cfg.orbitControls || !this.camera || !this.renderer)
                return;

            if (typeof(THREE.OrbitControls) !== "function")
                return;

            // v4 fix retained:
            // ensureTHREE() first builds a fallback scene/camera, then replaces it
            // with the editor/project scene/camera.  Recreate controls if the
            // active rendered camera changed.
            if (this.controls)
            {
                var sameCamera = (this.controlsCamera === this.camera) ||
                                 (this.controls.object === this.camera);
                if (sameCamera)
                    return;

                if (typeof(this.controls.dispose) === "function")
                    this.controls.dispose();

                this.controls = null;
                this.controlsCamera = null;
            }

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controlsCamera = this.camera;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;

            this.controls.target.set(
                cfg.fixedCameraTargetX || 0,
                cfg.fixedCameraTargetY || 0,
                cfg.fixedCameraTargetZ || 0
            );
            this.controls.update();

            this.installCanvasEventShield();
        };

        this.getOrbitControlsInfo = function()
        {
            return {
                hasControls: !!this.controls,
                controlsCameraIsRenderedCamera: !!this.controls &&
                    ((this.controlsCamera === this.camera) || (this.controls.object === this.camera)),
                eventShield: !!cfg.eventShield,
                eventShieldInstalled: !!this._eventShieldInstalled
            };
        };

        this.installCanvasEventShield = function()
        {
            if (!cfg.eventShield || this._eventShieldInstalled || !this.renderer || !this.renderer.domElement)
                return;

            this._eventShieldInstalled = true;

            var el = this.renderer.domElement;
            var opt = {capture:true, passive:false};
            var events = [
                "pointerdown", "pointermove", "pointerup", "pointercancel",
                "mousedown", "mousemove", "mouseup", "click", "dblclick",
                "wheel", "touchstart", "touchmove", "touchend", "contextmenu"
            ];

            var stop = function(ev)
            {
                // Do not use stopImmediatePropagation(), because OrbitControls also
                // listens on this same element and must still receive the event.
                ev.stopPropagation();

                if (ev.type === "contextmenu")
                    ev.preventDefault();
                else if (cfg.eventShieldPreventDefault && ev.cancelable)
                    ev.preventDefault();
            };

            for (var i = 0; i < events.length; i++)
            {
                try { el.addEventListener(events[i], stop, opt); }
                catch(e) { el.addEventListener(events[i], stop, true); }
            }
        };

        this.installResizeListener = function()
        {
            if (resizeListenerInstalled) return;
            resizeListenerInstalled = true;

            window.addEventListener("resize", function()
            {
                video3D.resizeRenderer();
            });
        };

        this.startRenderLoop = function()
        {
            if (renderLoopStarted) return;
            renderLoopStarted = true;

            function animate(now)
            {
                window.requestAnimationFrame(animate);

                var renderInterval = 1000 / Math.max(1, cfg.renderFPS | 0);
                if (now - lastRenderUpdate < renderInterval)
                    return;
                lastRenderUpdate = now;

                video3D.pumpTexture(now);

                if (video3D.controls)
                    video3D.controls.update();

                video3D.renderTHREEScene();
            }

            window.requestAnimationFrame(animate);
        };

        this.pumpTexture = function(now)
        {
            if (!this.screenTexture || !this.textureDirty)
                return;

            var textureInterval = 1000 / Math.max(1, cfg.textureFPS | 0);
            if (now - lastTextureUpdate < textureInterval)
                return;

            this.updateTextureCanvas();
            this.screenTexture.needsUpdate = true;
            this.textureDirty = false;
            lastTextureUpdate = now;
        };

        this.getTextureCanvas = function()
        {
            return this.textureCanvas;
        };

        this.getSourceCanvas = function()
        {
            return this.videoCanvas;
        };

        this.get2DRenderer = function()
        {
            return this.video2D;
        };

        this.getScene = function()
        {
            return this.scene;
        };

        this.getRenderer = function()
        {
            return this.renderer;
        };

        this.ctrl_dlg = function()
        {
            return Apple2VideoTHREE_controls(this);
        };

    }

Apple2VideoTHREE.ctrl_dlg = function()
{
    return Apple2VideoTHREE_controls(null);
};

if(typeof(oEMU)!="undefined" && oEMU.component && oEMU.component.Video)
    oEMU.component.Video.Apple2Video = new Apple2VideoTHREE();
