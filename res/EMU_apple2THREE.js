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
// - render that producer into a hidden 560x384 canvas;
// - expose that canvas as a THREE.CanvasTexture;
// - assign the texture to the 3D monitor screen material's map + emissiveMap;
// - update the texture at a throttled rate, initially 10fps.
//
// Recommended index.html include order:
//
//   <script src="res/gpu-browser.min.js"></script>
//   <script src="res/EMU_apple2GPU.js"></script>
//   <script src="https://unpkg.com/three@0.147.0/build/three.min.js"></script>
//   <script src="https://unpkg.com/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
//   <script src="res/EMU_apple2THREE.js"></script>
//
// Scene input for this v2:
//
//   Define THREE_scene before loading this file.  Example:
//
//     <script src="res/A2_Screen_beautified_smaller_v3.js"></script>
//     <script src="res/EMU_apple2THREE.js"></script>
//
//   where A2_Screen_beautified_smaller_v3.js contains:
//
//     const THREE_scene = { ... entire Three.js editor JSON object ... };
//
// Optional configuration before loading this file:
//
//   window.Apple2VideoTHREE_CONFIG = {
//       textureFPS: 10,
//       orbitControls: true,
//       emissiveColor: 0x00b36a,
//       emissiveIntensity: 2.5,
//       // Current A2 screen mesh needs this default correction:
//       // v1 looked upside down and horizontally mirrored; v2 over-corrected X.
//       textureFlipY: false,
//       textureMirrorX: false,
//       textureMirrorY: false,
//       eventShield: true,
//       eventShieldPreventDefault: false,
//       showGrid: false,
//       showAxes: false
//   };
//
// Notes:
// - The previous Apple2Video constructor is captured before this driver replaces
//   window.Apple2Video.  That previous constructor should normally be the one from
//   EMU_apple2GPU.js.
// - This file does not dynamically load Three.js.  Include Three.js externally.
// - This v3 does not fetch JSON, so it works when opened from file://.
// - v3 corrects the final horizontal mirror: flipY=false, mirrorX=false, mirrorY=false.
// - v3 keeps the optional canvas event shield to improve OrbitControls integration.
//

(function(global)
{
    "use strict";

    if (typeof(global.oEMU) === "undefined")
        global.oEMU = {"component":{"Video":{}}};
    else if (global.oEMU.component === undefined)
        global.oEMU.component = {"Video":{}};
    else if (global.oEMU.component.Video === undefined)
        global.oEMU.component.Video = {};

    // Capture the previously loaded compatible renderer before replacing it.
    // With the recommended include order this is EMU_apple2GPU.js.
    var Apple2Video2D = global.Apple2Video;

    var THREE_CFG_DEFAULT = {
        // v3 uses the global/lexical constant THREE_scene instead of fetch().
        // sceneURL intentionally removed to avoid browser CORS/file:// issues.
        textureFPS: 10,
        renderFPS: 60,
        orbitControls: true,
        emissiveColor: 0x00b36a,
        emissiveIntensity: 2.5,
        // Orientation correction for A2_Screen_beautified_smaller_v3:
        // v1 was upside down+mirrored; v2 still mirrored horizontally.
        textureFlipY: false,
        textureMirrorX: false,
        textureMirrorY: false,

        // Helps OrbitControls when parent/page code listens to canvas mouse events.
        // This stops pointer/mouse/wheel/touch events from bubbling beyond the canvas,
        // while still allowing OrbitControls' own listeners on the same canvas to run.
        eventShield: true,
        eventShieldPreventDefault: false,

        showGrid: false,
        showAxes: false,
        background: 0xf0f0f0,
        cameraAspectMul: 1.1
    };

    function cfgValue(name)
    {
        var cfg = global.Apple2VideoTHREE_CONFIG || {};
        return cfg[name] !== undefined ? cfg[name] : THREE_CFG_DEFAULT[name];
    }

    function copyConfig()
    {
        var cfg = {}, user = global.Apple2VideoTHREE_CONFIG || {};
        for (var k in THREE_CFG_DEFAULT) cfg[k] = THREE_CFG_DEFAULT[k];
        for (var u in user) cfg[u] = user[u];
        return cfg;
    }

    function getEmbeddedProjectScene()
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

        if (global.THREE_scene !== undefined)
            return global.THREE_scene;

        return null;
    }

    function Apple2VideoTHREE(canvas)
    {
        const DISPLAY_W = 560;
        const DISPLAY_H = 384;

        var video3D = this;
        var cfg = copyConfig();

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
        this.screenMesh = null;
        this.screenTexture = null;
        this.textureDirty = true;
        this.ready = false;
        this._eventShieldInstalled = false;

        this.textureCanvas = document.createElement("canvas");
        this.textureCanvas.width = DISPLAY_W;
        this.textureCanvas.height = DISPLAY_H;
        this.textureCanvas.style.width = DISPLAY_W + "px";
        this.textureCanvas.style.height = DISPLAY_H + "px";
        this.textureCanvas.style.display = "none";

        // Apple2Plus uses this test:
        //   new Apple2Video().initGPU === undefined ? pass 2D context : pass canvas
        // So this driver intentionally exposes initGPU, even though Three.js is not GPU.js.
        this.initGPU = function()
        {
            return true;
        };

        this.ensure2DRenderer = function()
        {
            if (this.video2D)
                return true;

            if (typeof(Apple2Video2D) !== "function" || Apple2Video2D === Apple2VideoTHREE)
            {
                console.warn("Apple2VideoTHREE: no previous Apple2Video renderer found. Load EMU_apple2GPU.js before EMU_apple2THREE.js.");
                return false;
            }

            this.video2D = new Apple2Video2D(this.textureCanvas);
            this.video2D.vidram = this.vidram;
            this.video2D.hw = this.hw;

            return true;
        };

        this.sync2DLinks = function()
        {
            if (!this.video2D) return;

            this.video2D.vidram = this.vidram;
            this.video2D.hw = this.hw;

            // EMU_apple2GPU.js redraw() calls apple2plus.vidObj().serial8 and
            // apple2plus.vidObj().kernel().  Therefore expose the 2D renderer's
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
                this.video2D.cycle();
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
                this.video2D.write(addr, d8);
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

            if (typeof(global.THREE) === "undefined")
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

            this.renderer.setPixelRatio(global.devicePixelRatio || 1);
            this.resizeRenderer();

            this.screenTexture = new THREE.CanvasTexture(this.textureCanvas);
            this.configureScreenTexture();

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
            return {
                textureFlipY: cfg.textureFlipY,
                textureMirrorX: cfg.textureMirrorX,
                textureMirrorY: cfg.textureMirrorY
            };
        };

        this.getTextureOrientation = function()
        {
            return {
                textureFlipY: cfg.textureFlipY,
                textureMirrorX: cfg.textureMirrorX,
                textureMirrorY: cfg.textureMirrorY
            };
        };

        this.loadProjectScene = function()
        {
            if (sceneLoadStarted) return;
            sceneLoadStarted = true;

            var json_proj = getEmbeddedProjectScene();
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

            cam.updateProjectionMatrix();
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

        this.installOrbitControls = function()
        {
            if (!cfg.orbitControls || !this.camera || !this.renderer)
                return;

            if (typeof(THREE.OrbitControls) !== "function")
                return;

            if (this.controls)
                return;

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;

            this.installCanvasEventShield();
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

            global.addEventListener("resize", function()
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
                global.requestAnimationFrame(animate);

                var renderInterval = 1000 / Math.max(1, cfg.renderFPS | 0);
                if (now - lastRenderUpdate < renderInterval)
                    return;
                lastRenderUpdate = now;

                video3D.pumpTexture(now);

                if (video3D.controls)
                    video3D.controls.update();

                if (video3D.renderer && video3D.scene && video3D.camera)
                    video3D.renderer.render(video3D.scene, video3D.camera);
            }

            global.requestAnimationFrame(animate);
        };

        this.pumpTexture = function(now)
        {
            if (!this.screenTexture || !this.textureDirty)
                return;

            var textureInterval = 1000 / Math.max(1, cfg.textureFPS | 0);
            if (now - lastTextureUpdate < textureInterval)
                return;

            this.screenTexture.needsUpdate = true;
            this.textureDirty = false;
            lastTextureUpdate = now;
        };

        this.getTextureCanvas = function()
        {
            return this.textureCanvas;
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
    }

    global.Apple2Video = Apple2VideoTHREE;
    global.oEMU.component.Video.Apple2Video = new Apple2VideoTHREE();

})(typeof(window) !== "undefined" ? window : this);
