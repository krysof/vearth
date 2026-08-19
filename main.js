/**
 * 太阳系 · Solar System
 * --------------------------------------------------------------
 * - Three.js r128（本地 UMD，无构建、离线可运行）
 * - 中心发光太阳 + 光晕
 * - 九大行星：水星 / 金星 / 地球 / 火星 / 木星 / 土星(光环) / 天王星 / 海王星 / 冥王星
 *   每颗都绕日公转（速度随距离递减）+ 自转
 * - 地球使用本地高清贴图，其余行星程序化生成纹理（无需外部资源）
 * - OrbitControls：拖拽旋转 / 滚轮缩放（带阻尼惯性）
 */
(function () {
  'use strict';

  var canvas = document.getElementById('globe');
  if (!canvas) return;

  // ---------- Renderer ----------
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMappingExposure = 1.0;

  // ---------- Scene & Camera ----------
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
  camera.position.set(30, 22, 48);

  // ---------- OrbitControls ----------
  var controls;
  try {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;      // 阻尼惯性
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 400;
    controls.target.set(0, 1, 6);       // 看向太阳附近
  } catch (e) { console.warn('OrbitControls unavailable', e); }

  var ANIMATE = true;                   // 公转动画开关
  document.getElementById('autorotate').addEventListener('change', function (e) {
    ANIMATE = e.target.checked;
  });

  // ---------- Lighting ----------
  var ambient = new THREE.AmbientLight(0x333344, 1.6);
  scene.add(ambient);

  // Sun itself emits light
  var sunLight = new THREE.PointLight(0xfff2d9, 3.0, 600, 1);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // ---------- Starfield（程序化星空）----------
  function buildStars() {
    var geo = new THREE.BufferGeometry();
    var N = 9000;
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var r = 400 + Math.random() * 600;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pos[i*3+2] = r * Math.cos(ph);
      var b = 0.5 + Math.random() * 4;
      col[i*3]=b; col[i*3+1]=b; col[i*3+2]=b*(0.85+Math.random()*0.25);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Points(geo, mat);
  }
  scene.add(buildStars());

  // ---------- Procedural planet texture generator ----------
  function makePlanetTexture(baseColor, stripes) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    var ctx = c.getContext('2d');
    var grd = ctx.createLinearGradient(0, 120, 160, 130);
    grd.addColorStop(0, 'rgb(' + baseColor + ')'); grd.addColorStop(1, shade(baseColor, -40));
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 512, 256);

    // random noise / bands
    for (var i = 0; i < 26000; i++) {
      var x = Math.random() * 511, y = Math.random() * 255;
      var a = 6 + Math.random() * 22;
      ctx.fillStyle = 'rgba(' + baseColor + ',' + (Math.random() * 0.14) + ')';
      ctx.beginPath(); ctx.arc(x, y, a, 0, Math.PI * 2); ctx.fill();
    }
    // horizontal stripes for gas giants
    if (stripes) {
      for (var s = 8; s < 256; s += 4 + Math.random() * 6) {
        var alpha = 0.04 + Math.random() * 0.1;
        ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
        ctx.fillRect(0, s + (Math.random()-0.5)*8, 512, 2);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  function shade(rgb, amt) {
    // input "r,g,b"; returns CSS 'rgb(...)' with adjusted brightness
    var parts = rgb.split(',').map(function (v) { return Math.max(0, Math.min(255, parseInt(v,10)+amt)); });
    return 'rgb(' + parts.join(',') + ')';
  }

  // ---------- Sun（发光太阳 + 光晕）----------
  function buildSun() {
    var group = new THREE.Group();
    // core
    var geo = new THREE.SphereGeometry(4.2, 64, 48);
    var c = document.createElement('canvas'); c.width=512;c.height=256;
    var ctx=c.getContext('2d');
    var g=ctx.createRadialGradient(200,128,10,256,128,300);
    g.addColorStop(0,'#fff7e0');g.addColorStop(.4,'#ffdf8a');g.addColorStop(.75,'#ff9d3c');g.addColorStop(1,'#cc3300');
    ctx.fillStyle=g;ctx.fillRect(0,0,512,256);
    var sunTex=new THREE.CanvasTexture(c);
    var mat = new THREE.MeshBasicMaterial({ map: sunTex });
    var core = new THREE.Mesh(geo, mat); group.add(core);

    // additive glow sprite
    var sprC=document.createElement('canvas');sprC.width=sprC.height=256;
    var sctx=sprC.getContext('2d');
    var rg=sctx.createRadialGradient(128,128,10,128,128,120);
    rg.addColorStop(0,'rgba(255,220,140,1)');rg.addColorStop(.5,'rgba(200,120,40,.55)');rg.addColorStop(1,'rgba(80,20,0,0)');
    sctx.fillStyle=rg;sctx.fillRect(0,0,256,256);
    var sprTex=new THREE.CanvasTexture(sprC);
    var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sprTex,blending:THREE.AdditiveBlending,depthWrite:false}));
    sprite.scale.set(30,30,1); group.add(sprite);

    return { group:group, core:core };
  }
  var sun = buildSun();
  scene.add(sun.group);

  // ---------- Planets data（九大行星）----------
  // name, radius, orbitRadius, speed (rad/frame), colorRGB, stripes, tilt
  var PLANETS = [
    { n:'水星', r:0.55, o:9,   sp:0.012, c:'180,160,150' },
    { n:'金星', r:0.85, o:12,  sp:0.009, c:'210,170,90'  },
    { n:'地球', r:0.95, o:16,  sp:0.0075,c:'60,120,200', earth:true },
    { n:'火星', r:0.7,  o:20,  sp:0.006, c:'190,80,45'   },
    { n:'木星', r:1.9,  o:26,  sp:0.0045,c:'200,150,90', stripes:true },
    { n:'土星', r:1.7,  o:33,  sp:0.0038,c:'215,180,120',stripes:true, ring:true },
    { n:'天王星',r:1.35,o:41,  sp:0.0026,c:'140,200,220' },
    { n:'海王星',r:1.3,  o:48,  sp:0.0018,c:'70,90,210'   },
    { n:'冥王星',r:0.45, o:55,  sp:0.0009,c:'150,120,100' }
  ];

  var loader = new THREE.TextureLoader();
  // earth textures (local, only for the actual Earth)
  var dayMap   = null;
  try {
    dayMap = loader.load('textures/earth_day_2048.jpg');
    dayMap.encoding = THREE.sRGBEncoding;
  } catch(e) {}

  function buildPlanet(p) {
    var group = new THREE.Group();
    // orbit ring line (visual guide)
    var ringGeo = new THREE.BufferGeometry();
    var segs = 128, pts = [];
    for (var i=0;i<=segs;i++){ var a=i/segs*Math.PI*2; pts.push(Math.cos(a)*p.o,0,Math.sin(a)*p.o); }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    var ringMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent:true, opacity:0.25 });
    var orbitLine = new THREE.LineLoop(ringGeo, ringMat);
    group.add(orbitLine);

    // planet mesh
    var geo = new THREE.SphereGeometry(p.r, 48, 32);
    var mat;
    if (p.earth && dayMap) {
      mat = new THREE.MeshPhongMaterial({ map: dayMap });
    } else {
      var tex = makePlanetTexture(p.c, p.stripes);
      mat = new THREE.MeshPhongMaterial({
        map: tex,
        emissive: 0x000000
      });
    }
    if (p.tilt) { /* could tilt axis */ }

    // planet holder group placed on orbit; mesh rotates for spin
    var pivot = new THREE.Group();     // positioned at radius, spins around sun via parent rotation
    var planetMesh = new THREE.Mesh(geo, mat);
    planetMesh.position.x = p.o;
    if (p.n === '天王星') planetMesh.rotation.z = 1.5;   // Uranus rolls on its side
    pivot.add(planetMesh);

    // ring for Saturn
    var rings=null;
    if (p.ring) {
      var rGeo=new THREE.RingGeometry(p.r*1.3, p.r*2.6, 64);
      var uv=rGeo.attributes.position; 
      // simple radial gradient via vertex colors not trivial; use material with opacity bands
      var ringTex=makeRingTexture();
      rings=new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
        map:ringTex, side:THREE.DoubleSide, transparent:true, opacity:0.75,
        depthWrite:false
      }));
      // flatten and orient horizontally; tilt a bit like Saturn 26.7deg
      rings.rotation.x = Math.PI/2 - 0.45;
      planetMesh.add(rings);
    }

    group.add(pivot);

    return { group:group, pivot:pivot, mesh:planetMesh };
  }

  function makeRingTexture() {
    var c=document.createElement('canvas');c.width=c.height=256;
    var ctx=c.getContext('2d');
    for (var r=40;r<120;r+=3){
      var a=0.05+Math.random()*0.25;
      ctx.strokeStyle='rgba(210,180,140,'+a+')';
      ctx.lineWidth=(1+Math.random()*2);
      ctx.beginPath();ctx.arc(128,128,r,0,Math.PI*2);ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  var planets = PLANETS.map(buildPlanet);
  planets.forEach(function(p){ scene.add(p.group); });

  // ---------- Animation loop ----------
  function animate() {
    requestAnimationFrame(animate);

    if (ANIMATE) {
      sun.core.rotation.y += 0.001;
      planets.forEach(function (p, idx) {
        var d = PLANETS[idx];
        p.pivot.rotation.y += d.sp;   // orbit around sun
        p.mesh.rotation.y += 0.01 + d.sp * 2;  // self rotation (spin)
      });
    }
    if (controls) controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ---------- Resize ----------
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Hide loader ----------
  var loaderEl = document.getElementById('loader');
  requestAnimationFrame(function hide() { if(loaderEl) loaderEl.classList.add('done'); });
})();
