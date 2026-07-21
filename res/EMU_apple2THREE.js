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
//   window.Apple2VideoTHREE_CONFIG = { ... };
// Runtime defaults live only in APPLE2_THREE_CFG_DEFAULT below.
// The UI and the initialized Three.js scene must read through the cfg helpers,
// never through separate literal fallbacks.

"use strict";

// Explicit dependency: THREE uses the GPU renderer as its hidden 2D producer.
// index.html defines Apple2VideoGPU before loading this file.
var Apple2VideoTHREE_2D = typeof(Apple2VideoGPU) == "function" ? Apple2VideoGPU : null;

var APPLE2_THREE_CFG_DEFAULT = 
{
        textureFPS: 10,
        renderFPS: 50,
        perspective: 30,
        orbitControls: false,
        lightMove: false,
        lightMoveHandles: true,
        lightIntensity: 0.45,

        baseMap: true,
        roughMetalMap: false,        
        fixedCameraLookAt: true,
        fixedCameraTargetX: 0,
        fixedCameraTargetY: 0,
        fixedCameraTargetZ: 0,

        emissiveColor: 0xFFFFFF,
        emissiveIntensity: 1,
        environmentLuminosity: 0,
        environmentLightIntensity: 0.45,

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
        textureSmoothing: true,

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

    function Apple2VideoTHREE_getEmbeddedDefaultImageMaps()
    {
        try
        {
            if (typeof(default_image_maps) !== "undefined")
                return default_image_maps;
        }
        catch(e) {}

        if (window.default_image_maps !== undefined)
            return window.default_image_maps;

        return null;
    }

    function Apple2VideoTHREE_isUsableImageDataUrl(url)
    {
        return typeof(url) == "string" &&
               url.indexOf("data:image/") == 0 &&
               url.indexOf("...") < 0 &&
               url.length > 32;
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

    function Apple2VideoTHREE_setTextureSmoothingControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setTextureSmoothing) !== "function") return;

        input.checked = renderer3D.setTextureSmoothing(input.checked);
    }

    function Apple2VideoTHREE_setLightMoveControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setLightMoveEnabled) !== "function") return;

        input.checked = renderer3D.setLightMoveEnabled(input.checked);
    }

    function Apple2VideoTHREE_syncLightIntensityControl(value)
    {
        var input = document.getElementById("threeLightIntensity");
        var output = document.getElementById("threeLightIntensityValue");

        value = Number(value);
        if (!isFinite(value)) value = 0;

        if (input) input.value = value;
        if (output) output.textContent = value.toFixed(2);
    }

    function Apple2VideoTHREE_setLightIntensityControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setLightIntensity) !== "function") return;

        var value = renderer3D.setLightIntensity(Number(input.value));
        Apple2VideoTHREE_syncLightIntensityControl(value);
    }

    function Apple2VideoTHREE_setEnvironmentControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setEnvironmentLuminosity) !== "function") return;

        var value = renderer3D.setEnvironmentLuminosity(Number(input.value) / 100);
        input.value = Math.round(value * 100);

        var output = document.getElementById("threeEnvironmentValue");
        if (output) output.textContent = Math.round(value * 100) + "%";
    }

    function Apple2VideoTHREE_resetCameraControl()
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.resetCameraPosition) !== "function") return;

        renderer3D.resetCameraPosition();
    }

    function Apple2VideoTHREE_resetLightControl()
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.resetLightPosition) !== "function") return;

        renderer3D.resetLightPosition();
        if (typeof(renderer3D.getLightIntensity) === "function")
            Apple2VideoTHREE_syncLightIntensityControl(renderer3D.getLightIntensity());

    }

    function Apple2VideoTHREE_setBaseMapControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setBaseMapEnabled) !== "function") return;

        input.checked = renderer3D.setBaseMapEnabled(input.checked);
    }

    function Apple2VideoTHREE_setRoughMetalControl(input)
    {
        var renderer3D = Apple2VideoTHREE_getControlInstance();
        if (!renderer3D || typeof(renderer3D.setRoughMetalEnabled) !== "function") return;

        input.checked = renderer3D.setRoughMetalEnabled(input.checked);
    }

    function Apple2VideoTHREE_controls(renderer3D)
    {
        var fov = renderer3D && typeof(renderer3D.getPerspective) === "function"
            ? renderer3D.getPerspective()
            : APPLE2_THREE_CFG_DEFAULT.perspective;
        var luminosity = renderer3D && typeof(renderer3D.getEmissiveIntensity) === "function"
            ? renderer3D.getEmissiveIntensity()
            : 1;
        var orbit = renderer3D && typeof(renderer3D.getOrbitEnabled) === "function"
            ? renderer3D.getOrbitEnabled()
            : !!APPLE2_THREE_CFG_DEFAULT.orbitControls;
        var lightMove = renderer3D && typeof(renderer3D.getLightMoveEnabled) === "function"
            ? renderer3D.getLightMoveEnabled()
            : !!APPLE2_THREE_CFG_DEFAULT.lightMove;
        var lightIntensity = renderer3D && typeof(renderer3D.getLightIntensity) === "function"
            ? renderer3D.getLightIntensity()
            : APPLE2_THREE_CFG_DEFAULT.lightIntensity;
        var baseMap = renderer3D && typeof(renderer3D.getBaseMapEnabled) === "function"
            ? renderer3D.getBaseMapEnabled()
            : !!APPLE2_THREE_CFG_DEFAULT.baseMap;
        var roughMetal = renderer3D && typeof(renderer3D.getRoughMetalEnabled) === "function"
            ? renderer3D.getRoughMetalEnabled()
            : !!APPLE2_THREE_CFG_DEFAULT.roughMetalMap;
        var smoothing = renderer3D && typeof(renderer3D.getTextureSmoothing) === "function"
            ? renderer3D.getTextureSmoothing()
            : !!APPLE2_THREE_CFG_DEFAULT.textureSmoothing;

        return "<div class=\"appbut mini\">"
            +"<input id=\"threePerspective\" type=\"range\" min=\"5\" max=\"90\" step=\"1\" value=\""+Math.round(fov)+"\" class=\"slider\""
            +" oninput=\"Apple2VideoTHREE_setPerspectiveControl(this)\" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">perspective "
            +"<span id=\"threePerspectiveValue\">"+Math.round(fov)+"°</span></div>"
            +"</div><br>"
            
            +"<div class=\"appbut mini\">"
            +"<input id=\"threeLuminosity\" type=\"range\" min=\"0\" max=\"300\" step=\"5\" value=\""+Math.round(luminosity*100)+"\" class=\"slider\""
            +" oninput=\"Apple2VideoTHREE_setLuminosityControl(this)\" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">screen luminosity "
            +"<span id=\"threeLuminosityValue\">"+Number(luminosity).toFixed(2)+"</span></div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeBaseMap\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setBaseMapControl(this)\""
            +(baseMap ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">base material</div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeRoughMetal\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setRoughMetalControl(this)\""
            +(roughMetal ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">rough/metal</div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeOrbit\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setOrbitControl(this)\""
            +(orbit ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
             +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">orbit camera"
             +"&nbsp;|&nbsp;<button type=\"button\" class=\"appbut mini\" onclick=\"Apple2VideoTHREE_resetCameraControl()\">reset</button>"
             +"</div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeMoveLight\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setLightMoveControl(this)\""
            +(lightMove ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">move light"
            +"&nbsp;|&nbsp;<button type=\"button\" class=\"appbut mini\" onclick=\"Apple2VideoTHREE_resetLightControl()\">reset</button>"
            +"</div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeLightIntensity\" type=\"range\" min=\"0\" max=\"5\" step=\"0.05\" value=\""+Number(lightIntensity).toFixed(2)+"\" class=\"slider\""
            +" oninput=\"Apple2VideoTHREE_setLightIntensityControl(this)\" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">light intensity "
            +"<span id=\"threeLightIntensityValue\">"+Number(lightIntensity).toFixed(2)+"</span></div>"
            +"</div><br>"

            +"<div class=\"appbut mini\">"
            +"<input id=\"threeTextureSmoothing\" type=\"checkbox\" onchange=\"Apple2VideoTHREE_setTextureSmoothingControl(this)\""
            +(smoothing ? " checked" : "")
            +" style=\"width:65px;float:left\"></input>"
            +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">smooth texture</div>"
            +"</div><br>"          
    }

    function Apple2VideoTHREE(canvas)
    {
        this.id = {
             "DCODE":"A2THR"
            ,"coID":"Apple2Video"
            ,"hostPCODE":"A2BO"
            ,"deviceIdx":2
            ,"icon":"fa fa-eye"
            ,"description":"Apple II Three.js video"
            ,"deviceEnable":true
        };


        const DISPLAY_W = 560;
        const DISPLAY_H = 384;

        var video3D = this;
        var cfg = Apple2VideoTHREE_copyConfig();

        var renderLoopStarted = false;
        var resizeListenerInstalled = false;
        var lastTextureUpdate = 0;
        var lastRenderUpdate = 0;
        var sceneLoadStarted = false;

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

        this.defaultCameraState = null;
        this.defaultLightState = null;
        this.sceneBounds = null;
        this.environmentLight = null;
        this.defaultMaterialTextures = {};

        this.lightMoveEnabled = !!cfg.lightMove;
        this.activeSceneLight = null;
        this.lightTransformControls = null;
        this.lightTransformHelper = null;
        this.lightMovePlane = null;
        this.lightMoveRaycaster = null;
        this.lightMoveNdc = null;
        this.lightMovePoint = null;
        this._lightMovePointerHandler = function(event)
        {
            video3D.onLightPointerMove(event);
        };
        this._lightMovePreviousCursor = "";

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

        this.getSceneNumber = function(key,lo,hi)
        {
            var value = Number(cfg[key]);
            if (!isFinite(value))
                value = Number(APPLE2_THREE_CFG_DEFAULT[key]);
            if (!isFinite(value))
                value = 0;

            if (lo !== undefined && value < lo) value = lo;
            if (hi !== undefined && value > hi) value = hi;
            return value;
        };

        this.getSceneBoolean = function(key)
        {
            var value = cfg[key];
            if (value === undefined)
                value = APPLE2_THREE_CFG_DEFAULT[key];
            return !!value;
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
            this.resizeTextureCanvas();

            this.screenTexture = new THREE.CanvasTexture(this.textureCanvas);
            this.applyInitialTextureSmoothing();

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
            return this.camera && this.camera.isPerspectiveCamera
                ? this.camera.fov
                : this.getSceneNumber("perspective",5,90);
        };

        this.updateSceneBounds = function()
        {
            if (!this.scene) return null;

            this.scene.updateMatrixWorld(true);
            var box = new THREE.Box3().setFromObject(this.scene);
            if (box.isEmpty())
            {
                this.sceneBounds = null;
                return null;
            }

            var size = box.getSize(new THREE.Vector3());
            if (!isFinite(size.length()) || size.lengthSq()===0)
            {
                this.sceneBounds = null;
                return null;
            }

            this.sceneBounds = box;
            return box;
        };

        this.getSceneCenter = function()
        {
            var box = this.sceneBounds || this.updateSceneBounds();
            if (box)
                return box.getCenter(new THREE.Vector3());

            return new THREE.Vector3(
                cfg.fixedCameraTargetX || 0,
                cfg.fixedCameraTargetY || 0,
                cfg.fixedCameraTargetZ || 0
            );
        };

        this.getCameraTarget = function()
        {
            if (this.controls && this.controls.target)
                return this.controls.target.clone();

            return this.getSceneCenter();
        };

        this.captureDefaultCameraState = function(camera,target)
        {
            if (!camera) return;
            target = target ? target.clone() : this.getSceneCenter();

            this.defaultCameraState = {
                 "position":camera.position.clone()
                ,"quaternion":camera.quaternion.clone()
                ,"up":camera.up.clone()
                ,"zoom":camera.zoom
                ,"fov":camera.isPerspectiveCamera ? camera.fov : 30
                ,"target":target
            };
        };

        this.resetCameraPosition = function()
        {
            if (!this.camera)
                this.ensureTHREE();

            var state = this.defaultCameraState;
            if (!this.camera || !state) return false;

            var direction = state.position.clone().sub(state.target);
            var distance = direction.length();

            if (this.camera.isPerspectiveCamera && distance > 0)
            {
                var currentFov = Math.max(1,this.camera.fov);
                distance *= Math.tan(state.fov*Math.PI/360) /
                            Math.tan(currentFov*Math.PI/360);
            }

            if (direction.lengthSq() > 0)
                direction.setLength(distance);

            this.camera.position.copy(state.target).add(direction);
            this.camera.quaternion.copy(state.quaternion);
            this.camera.up.copy(state.up);
            this.camera.zoom = state.zoom;
            this.camera.updateProjectionMatrix();
            this.camera.updateMatrix();
            this.camera.updateMatrixWorld(true);

            if (this.controls)
            {
                this.controls.target.copy(state.target);
                this.controls.update();
            }

            return true;
        };

        this.setPerspective = function(fov)
        {
            fov = Number(fov);
            if (!isFinite(fov)) fov = this.getPerspective();
            fov = Math.max(5,Math.min(90,fov));
            cfg.perspective = fov;

            if (!this.camera)
                this.ensureTHREE();

            if (this.camera && this.camera.isPerspectiveCamera)
            {
                var oldFov = this.camera.fov || 30;
                var target = this.getCameraTarget();

                if (Math.abs(fov-oldFov)>1e-6)
                {
                    var viewDir = new THREE.Vector3().subVectors(this.camera.position,target);
                    var oldDistance = viewDir.length();

                    if (oldDistance>1e-6)
                    {
                        var oldFovRad = THREE.MathUtils.degToRad(oldFov);
                        var newFovRad = THREE.MathUtils.degToRad(fov);
                        var visibleHeightAtTarget = 2*oldDistance*Math.tan(oldFovRad*0.5);
                        var newDistance = visibleHeightAtTarget/(2*Math.tan(newFovRad*0.5));

                        viewDir.normalize();
                        this.camera.position.copy(target).add(viewDir.multiplyScalar(newDistance));
                        this.camera.near = Math.max(newDistance/1000,0.001);
                        this.camera.far = Math.max(newDistance*1000,1000);
                    }
                }

                var w = this.canvas ? (this.canvas.clientWidth || this.canvas.width || DISPLAY_W) : DISPLAY_W;
                var h = this.canvas ? (this.canvas.clientHeight || this.canvas.height || DISPLAY_H) : DISPLAY_H;

                this.camera.fov = fov;
                this.camera.aspect = (w*cfg.cameraAspectMul)/Math.max(1,h);
                this.camera.updateProjectionMatrix();
                this.camera.lookAt(target);
                this.camera.updateMatrixWorld(true);

                if (this.controls)
                {
                    this.controls.target.copy(target);
                    this.controls.update();
                }
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

        this.getEnvironmentLuminosity = function()
        {
            var value = Number(cfg.environmentLuminosity);
            if (!isFinite(value)) value = 0;
            return Math.max(0,Math.min(1,value));
        };

        this.applyEnvironmentLuminosity = function()
        {
            if (!this.scene) return this.getEnvironmentLuminosity();

            var value = this.getEnvironmentLuminosity();
            this.scene.background = new THREE.Color(value,value,value);

            if (!this.environmentLight || this.environmentLight.parent!==this.scene)
            {
                this.environmentLight = this.scene.getObjectByName("__Apple2VideoTHREE_environment");
                if (!this.environmentLight)
                {
                    this.environmentLight = new THREE.AmbientLight(0xffffff,0);
                    this.environmentLight.name = "__Apple2VideoTHREE_environment";
                    this.scene.add(this.environmentLight);
                }
            }

            var gain = Number(cfg.environmentLightIntensity);
            if (!isFinite(gain)) gain = 0.45;
            this.environmentLight.intensity = value*Math.max(0,gain);

            return value;
        };

        this.setEnvironmentLuminosity = function(value)
        {
            value = Number(value);
            if (!isFinite(value)) value = this.getEnvironmentLuminosity();
            cfg.environmentLuminosity = Math.max(0,Math.min(1,value));

            if (!this.scene)
                this.ensureTHREE();

            return this.applyEnvironmentLuminosity();
        };

        this.getBaseMapEnabled = function()
        {
            return !!cfg.baseMap;
        };

        this.setBaseMapEnabled = function(flag)
        {
            cfg.baseMap = !!flag;
            this.applyScreenTextureMaterialSlots();
            return cfg.baseMap;
        };

        this.getRoughMetalEnabled = function()
        {
            return !!cfg.roughMetalMap;
        };

        this.setRoughMetalEnabled = function(flag)
        {
            cfg.roughMetalMap = !!flag;
            this.applyScreenTextureMaterialSlots();
            return cfg.roughMetalMap;
        };

        this.applyScreenMaterialProfile = function(mat)
        {
            if (!mat) return false;

            // Mirrors the scalar part of tools/GUI_DEV/THREEJS_loader.html
            // after APPLY BASE. Texture slots are managed separately below.
            if (mat.color) mat.color.set(0xffffff);
            if (mat.roughness !== undefined) mat.roughness = 1;
            if (mat.metalness !== undefined) mat.metalness = 0;
            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 0.45;

            mat.side = THREE.DoubleSide;
            mat.needsUpdate = true;
            return true;
        };

        this.applyDefaultTextureProfile = function(texture,slot)
        {
            if (!texture) return texture;

            var srgb = (slot == "map" || slot == "emissiveMap");
            texture.mapping = THREE.UVMapping;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1,1);
            texture.offset.set(0,0);
            texture.center.set(0,0);
            texture.rotation = 0;
            texture.format = THREE.RGBAFormat;
            texture.type = THREE.UnsignedByteType;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = 1;
            texture.flipY = false;
            texture.generateMipmaps = true;
            texture.premultiplyAlpha = false;
            texture.unpackAlignment = 4;

            if (srgb)
            {
                if (THREE.SRGBColorSpace !== undefined)
                    texture.colorSpace = THREE.SRGBColorSpace;
                else if (THREE.sRGBEncoding !== undefined)
                    texture.encoding = THREE.sRGBEncoding;
            }
            else
            {
                if (THREE.NoColorSpace !== undefined)
                    texture.colorSpace = THREE.NoColorSpace;
                else if (THREE.LinearEncoding !== undefined)
                    texture.encoding = THREE.LinearEncoding;
            }

            texture.needsUpdate = true;
            return texture;
        };

        this.getDefaultMaterialTexture = function(slot)
        {
            var maps = Apple2VideoTHREE_getEmbeddedDefaultImageMaps();
            if (!maps) return null;

            var url = maps[slot];
            if (slot == "roughMetal")
                url = maps.roughnessMap || maps.metalnessMap;

            if (!Apple2VideoTHREE_isUsableImageDataUrl(url))
                return null;

            if (this.defaultMaterialTextures[slot])
                return this.defaultMaterialTextures[slot];

            var texture = new THREE.TextureLoader().load(url,function(tex)
            {
                video3D.applyDefaultTextureProfile(tex,slot);
                video3D.applyScreenTextureMaterialSlots();
                video3D.textureDirty = true;
            });

            texture.name = "__Apple2VideoTHREE_default_" + slot;
            this.applyDefaultTextureProfile(texture,slot);
            this.defaultMaterialTextures[slot] = texture;

            return texture;
        };

        this.applyScreenTextureMaterialSlots = function()
        {
            var screen = this.screenMesh || this.findScreenMesh();
            if (!screen)
                return false;

            this.screenMesh = screen;

            var baseTexture = cfg.baseMap
                ? (this.getDefaultMaterialTexture("map") || this.screenTexture)
                : null;

            var roughTexture = cfg.roughMetalMap
                ? (this.getDefaultMaterialTexture("roughnessMap") ||
                   this.getDefaultMaterialTexture("roughMetal"))
                : null;

            var metalTexture = cfg.roughMetalMap
                ? (this.getDefaultMaterialTexture("metalnessMap") || roughTexture)
                : null;

            var materials = Array.isArray(screen.material) ? screen.material : [screen.material];
            for (var i=0;i<materials.length;i++)
            {
                var mat = materials[i];
                if (!mat) continue;

                this.applyScreenMaterialProfile(mat);

                mat.map = baseTexture;

                if (mat.emissive !== undefined)
                {
                    mat.emissive = new THREE.Color(cfg.emissiveColor);
                    mat.emissiveMap = this.screenTexture;
                    mat.emissiveIntensity = cfg.emissiveIntensity;
                }

                mat.roughnessMap = roughTexture;
                mat.metalnessMap = metalTexture;
                mat.needsUpdate = true;
            }

            this.textureDirty = true;
            return true;
        };

        this.getTextureSmoothing = function()
        {
            return !!cfg.textureSmoothing;
        };

        this.applyInitialTextureSmoothing = function()
        {
            return this.setTextureSmoothing(this.getSceneBoolean("textureSmoothing"));
        };

        this.resizeTextureCanvas = function()
        {
            var scale = cfg.textureSmoothing ? 2 : 1;
            var width = DISPLAY_W*scale;
            var height = DISPLAY_H*scale;

            if (this.textureCanvas.width !== width)
                this.textureCanvas.width = width;
            if (this.textureCanvas.height !== height)
                this.textureCanvas.height = height;

            this.textureCtx = this.textureCanvas.getContext("2d",{alpha:false});
        };

        this.setTextureSmoothing = function(flag)
        {
            cfg.textureSmoothing = !!flag;
            this.resizeTextureCanvas();
            this.configureScreenTexture();
            this.updateTextureCanvas();

            if (this.screenTexture)
                this.screenTexture.needsUpdate = true;

            this.textureDirty = true;
            return cfg.textureSmoothing;            
        };

        this.renderTHREEScene = function()
        {
            if (!this.renderer || !this.scene || !this.camera) return;

            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene,this.camera);           
        };



        this.configureScreenTexture = function()
        {
            if (!this.screenTexture) return;

            this.screenTexture.flipY = !!cfg.textureFlipY;
            this.screenTexture.wrapS = THREE.ClampToEdgeWrapping;
            this.screenTexture.wrapT = THREE.ClampToEdgeWrapping;
            this.screenTexture.minFilter = THREE.LinearFilter;
            this.screenTexture.magFilter = cfg.textureSmoothing
                ? THREE.LinearFilter
                : THREE.NearestFilter;            
            this.screenTexture.generateMipmaps = false;
            var maxAnisotropy = this.renderer && this.renderer.capabilities &&
                typeof(this.renderer.capabilities.getMaxAnisotropy) === "function"
                ? this.renderer.capabilities.getMaxAnisotropy()
                : 1;
            this.screenTexture.anisotropy = cfg.textureSmoothing
                ? Math.max(1,maxAnisotropy)
                : 1;
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

            var scaleX = this.textureCanvas.width/DISPLAY_W;
            var scaleY = this.textureCanvas.height/DISPLAY_H;

            var l = Math.round(Apple2VideoTHREE_clampInt(cfg.texturePadLeft,   0, DISPLAY_W - 1)*scaleX);
            var t = Math.round(Apple2VideoTHREE_clampInt(cfg.texturePadTop,    0, DISPLAY_H - 1)*scaleY);
            var r = Math.round(Apple2VideoTHREE_clampInt(cfg.texturePadRight,  0, DISPLAY_W - 1)*scaleX);
            var b = Math.round(Apple2VideoTHREE_clampInt(cfg.texturePadBottom, 0, DISPLAY_H - 1)*scaleY);

            var dw = this.textureCanvas.width - l - r;
            var dh = this.textureCanvas.height - t - b;

            if (dw < 1) dw = 1;
            if (dh < 1) dh = 1;

            var ctx = this.textureCtx;
            ctx.save();
            ctx.imageSmoothingEnabled = !!cfg.textureSmoothing;
            if ("imageSmoothingQuality" in ctx)
                ctx.imageSmoothingQuality = cfg.textureSmoothing ? "high" : "low";
            ctx.fillStyle = cfg.texturePadColor || "#000000";
            ctx.fillRect(0,0,this.textureCanvas.width,this.textureCanvas.height);
            ctx.drawImage(this.videoCanvas,0,0,DISPLAY_W,DISPLAY_H,l,t,dw,dh);
            
            ctx.restore();
        };

        this.getConfiguredInitialPerspective = function()
        {
            return this.getSceneNumber("perspective",5,90);
        };

        this.applyInitialPerspective = function()
        {
            if (!this.camera || !this.camera.isPerspectiveCamera)
                return false;

            this.setPerspective(this.getConfiguredInitialPerspective());
            this.captureDefaultCameraState(this.camera,this.getCameraTarget());
            return true;
        };

        this.getConfiguredInitialLightIntensity = function()
        {
            return this.getSceneNumber("lightIntensity",0,5);
        };

        this.applyInitialLightIntensity = function()
        {
            var light = this.findMovableLight();
            if (!light || light.intensity === undefined)
                return false;

            light.intensity = this.getConfiguredInitialLightIntensity();
            light.updateMatrixWorld(true);

            if (light.userData)
                delete light.userData.__Apple2VideoTHREE_defaultLight;

            this.captureDefaultLightState(light);

            if (typeof(Apple2VideoTHREE_syncLightIntensityControl) === "function")
                Apple2VideoTHREE_syncLightIntensityControl(light.intensity);

            return true;
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
            this.updateSceneBounds();

            this.camera = this.cameraFromProject(json_proj.camera);
            this.applyInitialPerspective();
            this.attachTextureToScreen();
            this.applyEnvironmentLuminosity();
            this.applyInitialLightIntensity();

            if (cfg.showGrid)
                this.scene.add(new THREE.GridHelper(200, 20));

            if (cfg.showAxes)
                this.scene.add(new THREE.AxesHelper(60));

            this.installOrbitControls();
            if (this.lightMoveEnabled)
                this.setLightMoveEnabled(true);
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

            var target = this.getSceneCenter();
            if (cfg.fixedCameraLookAt)
                cam.lookAt(target);

            cam.updateProjectionMatrix();
            cam.updateMatrix();
            cam.updateMatrixWorld(true);
            this.captureDefaultCameraState(cam,target);

            return cam;
        };

        this.makeFallbackCamera = function()
        {
            var cam = new THREE.PerspectiveCamera(this.getSceneNumber("perspective",5,90), DISPLAY_W / DISPLAY_H, 0.01, 1000);
            cam.position.set(0, 0, 3.2);
            cam.lookAt(0, 0, 0);
            cam.updateMatrix();
            cam.updateMatrixWorld(true);
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

            var light = new THREE.DirectionalLight(0xffffff, this.getSceneNumber("lightIntensity",0,5));
            light.position.set(2, 4, 3);
            this.scene.add(light);

            this.updateSceneBounds();
            this.applyInitialPerspective();
            this.captureDefaultCameraState(this.camera,this.getSceneCenter());
            this.applyEnvironmentLuminosity();
            this.applyInitialLightIntensity();
            this.installOrbitControls();
            if (this.lightMoveEnabled)
                this.setLightMoveEnabled(true);
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
            return this.applyScreenTextureMaterialSlots();
        };

        this.findMovableLight = function()
        {
            if (!this.scene) return null;

            var pointLight = null;
            var positionedLight = null;

            this.scene.traverse(function(obj)
            {
                if (!pointLight && obj.isPointLight)
                    pointLight = obj;

                if (!positionedLight && obj.isLight &&
                    !obj.isAmbientLight && !obj.isHemisphereLight && obj.position)
                    positionedLight = obj;
            });

            return pointLight || positionedLight;
        };

        this.captureDefaultLightState = function(light)
        {
            if (!light || !light.position) return null;

            if (!light.userData)
                light.userData = {};

            if (!light.userData.__Apple2VideoTHREE_defaultLight)
            {
                light.userData.__Apple2VideoTHREE_defaultLight = {
                     "position": light.position.clone()
                    ,"intensity": light.intensity
                    ,"distance": light.distance
                    ,"decay": light.decay
                };
            }

            this.defaultLightState = light.userData.__Apple2VideoTHREE_defaultLight;
            return this.defaultLightState;
        };

        this.resetLightPosition = function()
        {
            if (!this.scene)
                this.ensureTHREE();

            var light = this.activeSceneLight || this.findMovableLight();
            if (!light) return false;

            var state = this.captureDefaultLightState(light);
            if (!state) return false;

            light.position.copy(state.position);

            if (state.intensity !== undefined) light.intensity = state.intensity;
            if (state.distance  !== undefined) light.distance  = state.distance;
            if (state.decay     !== undefined) light.decay     = state.decay;

            light.updateMatrixWorld(true);

            if (this.lightTransformControls &&
                typeof(this.lightTransformControls.updateMatrixWorld) == "function")
                this.lightTransformControls.updateMatrixWorld(true);

            if (this.lightMoveEnabled && this.lightMovePlane && this.camera)
            {
                var normal = new THREE.Vector3();
                this.camera.getWorldDirection(normal);
                this.lightMovePlane.setFromNormalAndCoplanarPoint(normal,light.position);
            }

            return true;
        };

        this.installLightTransformControls = function(light)
        {
            if (!cfg.lightMoveHandles || !light || !this.scene || !this.camera ||
                !this.renderer || typeof(THREE.TransformControls) != "function")
                return false;

            if (!this.lightTransformControls)
            {
                var controls3D = new THREE.TransformControls(this.camera,this.renderer.domElement);
                controls3D.setMode("translate");
                if (typeof(controls3D.setSize) == "function")
                    controls3D.setSize(0.8);
                controls3D.name = "__Apple2VideoTHREE_light_transform";

                controls3D.addEventListener("dragging-changed",function(event)
                {
                    if (video3D.controls)
                        video3D.controls.enabled = !video3D.lightMoveEnabled &&
                                                   !event.value &&
                                                   !!cfg.orbitControls;
                });

                controls3D.addEventListener("objectChange",function()
                {
                    if (video3D.activeSceneLight)
                    {
                        video3D.activeSceneLight.updateMatrixWorld(true);

                        if (video3D.lightMovePlane && video3D.camera)
                        {
                            var normal = new THREE.Vector3();
                            video3D.camera.getWorldDirection(normal);
                            video3D.lightMovePlane.setFromNormalAndCoplanarPoint(
                                normal,
                                video3D.activeSceneLight.position
                            );
                        }
                    }
                });

                controls3D.addEventListener("change",function()
                {
                    video3D.renderTHREEScene();
                });

                this.lightTransformControls = controls3D;
            }
            else
            {
                this.lightTransformControls.camera = this.camera;
            }

            this.lightTransformHelper =
                typeof(this.lightTransformControls.getHelper) == "function"
                    ? this.lightTransformControls.getHelper()
                    : this.lightTransformControls;

            if (this.lightTransformHelper && this.lightTransformHelper.parent !== this.scene)
                this.scene.add(this.lightTransformHelper);

            this.lightTransformControls.attach(light);
            return true;
        };

        this.detachLightTransformControls = function()
        {
            if (this.lightTransformControls &&
                typeof(this.lightTransformControls.detach) == "function")
                this.lightTransformControls.detach();

            if (this.lightTransformHelper && this.lightTransformHelper.parent)
                this.lightTransformHelper.parent.remove(this.lightTransformHelper);
        };

        this.getLightIntensity = function()
        {
            var light = this.activeSceneLight || this.findMovableLight();
            if (!light || light.intensity === undefined)
                return this.getSceneNumber("lightIntensity",0,5);

            var value = Number(light.intensity);
            return isFinite(value) ? value : this.getSceneNumber("lightIntensity",0,5);
        };

        this.setLightIntensity = function(intensity)
        {
            intensity = Number(intensity);
            if (!isFinite(intensity)) intensity = this.getLightIntensity();
            intensity = Math.max(0,Math.min(5,intensity));
            cfg.lightIntensity = intensity;

            if (!this.scene)
                this.ensureTHREE();

            var light = this.activeSceneLight || this.findMovableLight();
            if (!light || light.intensity === undefined)
                return intensity;

            this.captureDefaultLightState(light);
            light.intensity = intensity;
            light.updateMatrixWorld(true);

            return intensity;
        };

        this.getLightMoveEnabled = function()
        {
            return !!this.lightMoveEnabled;
        };

        this.setLightMoveEnabled = function(flag)
        {
            flag = !!flag;
            cfg.lightMove = flag;

            if (flag && !this.renderer)
                this.ensureTHREE();

            var el = this.renderer && this.renderer.domElement;
            if (!flag)
            {
                if (el)
                {
                    el.removeEventListener("pointermove",this._lightMovePointerHandler,true);
                    el.style.cursor = this._lightMovePreviousCursor || "";
                }

                this.detachLightTransformControls();

                cfg.lightMove = false;
                this.lightMoveEnabled = false;
                this.activeSceneLight = null;

                if (this.controls)
                    this.controls.enabled = !!cfg.orbitControls;

                return false;
            }

            var light = this.findMovableLight();
            if (!el || !this.camera || !light)
            {
                cfg.lightMove = false;
                this.lightMoveEnabled = false;
                return false;
            }

            if (!this.lightMovePlane)
            {
                this.lightMovePlane = new THREE.Plane();
                this.lightMoveRaycaster = new THREE.Raycaster();
                this.lightMoveNdc = new THREE.Vector2();
                this.lightMovePoint = new THREE.Vector3();
            }

            this.captureDefaultLightState(light);
            this.activeSceneLight = light;
            this.lightMoveEnabled = true;

            var normal = new THREE.Vector3();
            this.camera.getWorldDirection(normal);
            this.lightMovePlane.setFromNormalAndCoplanarPoint(normal,light.position);

            if (this.controls)
                this.controls.enabled = false;

            var hasTransformHandles = this.installLightTransformControls(light);
            el.removeEventListener("pointermove",this._lightMovePointerHandler,true);

            if (hasTransformHandles)
            {
                el.style.cursor = this._lightMovePreviousCursor || "";
            }
            else
            {
                this._lightMovePreviousCursor = el.style.cursor || "";
                el.addEventListener("pointermove",this._lightMovePointerHandler,true);
                el.style.cursor = "crosshair";
            }


            return true;
        };

        this.onLightPointerMove = function(event)
        {
            if (!this.lightMoveEnabled || !this.activeSceneLight ||
                !this.lightMoveRaycaster || !this.lightMovePlane ||
                !this.renderer || !this.camera)
                return;

            var rect = this.renderer.domElement.getBoundingClientRect();
            this.lightMoveNdc.x =
                ((event.clientX-rect.left)/Math.max(1,rect.width))*2-1;
            this.lightMoveNdc.y =
                -(((event.clientY-rect.top)/Math.max(1,rect.height))*2-1);

            this.lightMoveRaycaster.setFromCamera(this.lightMoveNdc,this.camera);
            var hit = this.lightMoveRaycaster.ray.intersectPlane(
                this.lightMovePlane,
                this.lightMovePoint
            );

            if (!hit) return;

            this.activeSceneLight.position.copy(this.lightMovePoint);
            this.activeSceneLight.updateMatrixWorld(true);

            if (event.cancelable)
                event.preventDefault();
            event.stopPropagation();
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

            this.controls.target.copy(this.getSceneCenter());
            this.controls.enabled = !this.lightMoveEnabled;
            this.controls.update();
            if (typeof(this.controls.saveState)==="function")
                this.controls.saveState();

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
