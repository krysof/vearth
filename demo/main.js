/**
 * 自转地球 · 3D Globe
 * --------------------------------------------------------------
 * - Three.js r128（本地 UMD，无构建、离线可运行）
 * - 高清地球贴图（昼夜 + 法线 + 高光）+ 半透明云层
 * - Fresnel 大气辉光着色器
 * - 程序化星空背景（无需外部纹理）
 * - OrbitControls：拖拽旋转 / 滚轮缩放（带阻尼惯性）
 * - 自动自转（可开关，独立于用户交互）
 */
(function () {
  'use strict';

  var canvas = document.getElementById('globe');
  if (!canvas) return;

  // ---------- Renderer ----------
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  // toneMapping 在软件 WebGL(SwiftShader)下可能过曝，这里保持默认即可

  // ---------- Scene & Camera ----------
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2.5, 6.5);

  // ---------- OrbitControls（交互旋转 + 缩放）----------
  var controls;
  try {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;      // 阻尼惯性
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;         // 最近缩放距离（避免穿入地球）
    controls.maxDistance = 14;
    controls.enablePan = false;         // 禁用平移，聚焦地球旋转
    controls.autoRotateSpeed = 1.6;     // OrbitControls 自身也可自转（备用方案）
  } catch (e) {
    console.warn('OrbitControls unavailable', e);
  }

  var AUTO_ROTATE = true;               // 自动自转开关
  document.getElementById('autorotate').addEventListener('change', function (e) {
    AUTO_ROTATE = e.target.checked;
  });

  // ---------- Starfield（程序化星空，无需外部纹理）----------
  var starsGeo = new THREE.BufferGeometry();
  var STAR_COUNT = 5000;
  var positions = new Float32Array(STAR_COUNT * 3);
  var colors = new Float32Array(STAR_COUNT * 3);
  for (var i = 0; i < STAR_COUNT; i++) {
    // 随机分布在球壳上（半径远大于地球）
    var r = 200 + Math.random() * 300;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    // 星星颜色：白/淡蓝/暖黄，略带随机亮度
    var bright = 0.6 + Math.random() * 1.4;
    colors[i * 3]     = bright;
    colors[i * 3 + 1] = bright;
    colors[i * 3 + 2] = bright * (0.9 + Math.random() * 0.15);
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var starMat = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(starsGeo, starMat));

  // ---------- TextureLoader（本地贴图，离线可用）----------
  var loader = new THREE.TextureLoader();

  function loadTex(url) {
    return loader.load(url);
  }

  var dayMap   = loadTex('textures/earth_day_2048.jpg');   // 高清地球
  var normalMap= loadTex('textures/normal_2048.jpg');
  var specular = loadTex('textures/specular_2048.jpg');
  var cloudsTx = loadTex('textures/clouds_1024.png');

  [dayMap, normalMap, specular].forEach(function (t) {
    t.encoding = THREE.sRGBEncoding;
  });

  // ---------- Earth mesh（高清贴图 + 法线 + 高光）----------
  var earthGeo   = new THREE.SphereGeometry(2, 64, 48);
  var earthMat   = new THREE.MeshPhongMaterial({
    map: dayMap,
    normalMap: normalMap,
    specularMap: specular,
    specular: new THREE.Color(0x2a3540),
    shininess: 28
  });
  var earth = new THREE.Mesh(earthGeo, earthMat);
  scene.add(earth);

  // ---------- Clouds（半透明云层，独立旋转更快）----------
  var cloudGeo   = new THREE.SphereGeometry(2.02, 64, 48);
  var cloudMat   = new THREE.MeshPhongMaterial({
    map: cloudsTx,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  var clouds = new THREE.Mesh(cloudGeo, cloudMat);
  scene.add(clouds);

  // ---------- Atmosphere glow（Fresnel 蓝色大气辉光）----------
  var atmosShader = {
    uniforms: {
      c: { value: 0.35 },
      p: { value: 5.2 },
      glowColor: { value: new THREE.Color(0x4d9eff) }
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'void main() {',
      '  vNormal = normalize(normalMatrix * normal);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 glowColor;',
      'uniform float c;',
      'uniform float p;',
      'varying vec3 vNormal;',
      'void main() {',
      '  float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);',
      '  gl_FragColor = vec4(glowColor * intensity, 1.0);',
      '}'
    ].join('\n'),
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
  };
  var atmosMat = new THREE.ShaderMaterial(atmosShader);
  var atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.3, 64, 48), atmosMat);
  scene.add(atmosphere);

  // ---------- Lighting（光照：主光 + 环境补光）----------
  var sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunLight.position.set(-5, 2, 6);       // 从右上方打光，模拟太阳
  scene.add(sunLight);

  var ambient = new THREE.AmbientLight(0x222233, 1.3);
  scene.add(ambient);

  // ---------- Animation loop（自转 + 控制更新）----------
  function animate() {
    requestAnimationFrame(animate);

    if (AUTO_ROTATE) {
      earth.rotation.y += 0.0016;   // 地球自转
      clouds.rotation.y += 0.0024;  // 云层更快漂移
    }

    if (controls) controls.update(); // 应用阻尼/自动旋转

    renderer.render(scene, camera);
  }
  animate();

  // ---------- Resize handling ----------
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Hide loader after first frame ----------
  var loaderEl = document.getElementById('loader');
  requestAnimationFrame(function hideLoader() {
    if (loaderEl) loaderEl.classList.add('done');
    console.log('[Globe] first frame rendered');
  });
})();
