/* =========================================================
   Virtual Earth — Three.js interactive 3D globe (no build step)
   Uses local vendor libs: three.min.js + OrbitControls.js (r128)
   Textures are local files in /assets/textures
   ========================================================= */
window.addEventListener('error', (e) => console.error('[VEarth] ERROR:', e.message));
(function () {
  'use strict';

  const EARTH_RADIUS = 5;
  const CLOUD_RADIUS = EARTH_RADIUS * 1.012;

  /* ---------- Basic scene setup ---------- */
  const container = document.body;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  // slightly dark scene so the sun-lit side reads nicely
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    innerWidth / innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, EARTH_RADIUS * 2.6, EARTH_RADIUS * 4);

  // Sun light (directional) + soft ambient fill
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(EARTH_RADIUS * 3, EARTH_RADIUS * 2, EARTH_RADIUS * 3);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0x334466, 0.55);
  scene.add(amb);

  // Controls
  let controls;
  try {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = EARTH_RADIUS * 1.35;
    controls.maxDistance = EARTH_RADIUS * 8;
    controls.rotateSpeed = 0.6;
    controls.enablePan = false;
    // keep the globe upright-ish but allow free orbit
    controls.target.set(0, 0, 0);
  } catch (e) {
    console.warn('OrbitControls unavailable', e);
  }

  /* ---------- Texture loading helper ---------- */
  const loader = new THREE.TextureLoader();
  function loadTex(url) {
    const t = loader.load(url);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  // Pre-warm: set colorSpace for correct tone mapping
  const isSRGBish = typeof THREE.sRGBEncoding !== 'undefined';
  if (isSRGBish) { renderer.outputEncoding = THREE.sRGBEncoding; }

  /* ---------- Earth ---------- */
  let earthGroup;
  function buildEarth() {
    // We load textures AFTER showing loader success; wrap in try for robustness.
    const dayMap   = loadTex('assets/textures/earth_day_2048.jpg');
    const specular = loadTex('assets/textures/specular_2048.jpg');
    const normal   = loadTex('assets/textures/normal_2048.jpg');

    earthGroup = new THREE.Group();

    const geo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
    const mat = new THREE.MeshPhongMaterial({
      map: dayMap,
      specularMap: specular,
      normalMap: normal,
      specular: new THREE.Color(0x333344),
      shininess: 18,
    });
    if (isSRGBish) { dayMap.encoding = THREE.sRGBEncoding; }

    const earth = new THREE.Mesh(geo, mat);
    // rotate so the prime meridian faces +Z at start
    earthGroup.add(earth);

    scene.add(earthGroup);
  }
  buildEarth();

  /* ---------- Clouds (transparent layer) ---------- */
  let clouds;
  {
    const map = loadTex('assets/textures/clouds_1024.png');
    if (isSRGBish) map.encoding = THREE.sRGBEncoding;
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(CLOUD_RADIUS, 48, 32),
      new THREE.MeshPhongMaterial({
        map: map,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    scene.add(clouds);
  }

  /* ---------- Atmosphere glow (fresnel rim shader) ---------- */
  {
    const vs = `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vNormal   = normalize(normalMatrix * normal);
        vViewDir  = -normalize(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`;
    const fs = `
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        float rim = pow(1.0 - abs(dot(vNormal, normalize(vViewDir))), intensity);
        gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * 1.15, rim * 0.85);
      }`;
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: { intensity: { value: 3.2 } },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.18, 64, 48),
      glowMat
    );
    scene.add(glow);
  }

  /* ---------- Starfield background ---------- */
  {
    function makeStars() {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      // faint milky-way-ish gradient
      const g = ctx.createRadialGradient(512, 380, 60, 420, 460, 900);
      g.addColorStop(0, 'rgba(40,50,80,.5)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 400, c.width, 500);

      for (let i = 0; i < 2600; i++) {
        const r = Math.random();
        const size = r > 0.985 ? 2.4 : r > 0.9 ? 1.6 : Math.random() * 1.1 + 0.3;
        ctx.globalAlpha = 0.35 + Math.random() * 0.65;
        ctx.fillStyle = `rgb(${210+Math.random()*45},${215+Math.random()*40},255)`;
        const x = Math.floor(Math.random() * c.width);
        const y = Math.floor(Math.random() * c.height);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      return new THREE.CanvasTexture(c);
    }

    const starMat = new THREE.MeshBasicMaterial({
      map: makeStars(),
      side: THREE.BackSide,
      depthWrite: false,
    });
    if (isSRGBish) starMat.map.encoding = THREE.sRGBEncoding;
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(180, 48, 32), starMat));
  }

  /* ---------- City markers ---------- */
  const CITIES = [
    { name: '北京', en: 'Beijing', lat: 39.9, lng: 116.4, desc: '中国首都，历史文化名城。' },
    { name: '东京', en: 'Tokyo',   lat: 35.7, lng: 139.69, desc: '日本首都，全球最大都市圈之一。' },
    { name: '纽约', en: 'New York',lat: 40.71,lng: -74.0, desc: '美国金融与文化中心。' },
    { name: '伦敦', en: 'London',  lat: 51.5, lng: -0.12, desc: '英国首都，国际大都市。' },
    { name: '巴黎', en: 'Paris',   lat: 48.85,lng: 2.35, desc: '法国首都，艺术与时尚之都。' },
    { name: '悉尼', en: 'Sydney',  lat:-33.87,lng:151.21, desc: '澳大利亚最大城市，位于南半球。' },
    { name: '里约热内卢', en:'Rio de Janeiro',lat:-22.91,lng:-43.17,desc:'巴西著名海滨城市。' },
    { name: '开普敦', en:'Cape Town',lat:-33.92,lng:18.42, desc:'南非立法首都，好望角所在。' },
  ];

  // Convert lat/lon (deg) to unit vector on a sphere of given radius.
  function latLngToVec3(lat, lng, r) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lng + 270) * Math.PI) / 360; // match three.js texture orientation
    return new THREE.Vector3(
      -(r * Math.sin(phi) * Math.cos(theta)),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  const markers = [];
  function buildMarkers() {
    const markerGeo = new THREE.SphereGeometry(EARTH_RADIUS * 0.018, 12, 10);
    CITIES.forEach((c) => {
      const pos = latLngToVec3(c.lat, c.lng, EARTH_RADIUS * 1.004);
      // glowing dot
      const mat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
      const m = new THREE.Mesh(markerGeo, mat.clone());
      m.position.copy(pos);
      m.userData.city = c;
      scene.add(m);
      markers.push(m);

      // soft halo sprite
      const haloTex = (function () {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const x = cv.getContext('2d');
        const rg = x.createRadialGradient(32, 30, 0, 31, 29, 26);
        rg.addColorStop(0, 'rgba(79,195,247,.9)');
        rg.addColorStop(1, 'transparent');
        x.fillStyle = rg;
        x.fillRect(0, 6, cv.width, cv.height);
        return new THREE.CanvasTexture(cv);
      })();
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(haloMat);
      sprite.position.copy(pos).multiplyScalar(1.02);
      sprite.scale.set(EARTH_RADIUS * 0.12, EARTH_RADIUS * 0.10, 1);
      scene.add(sprite);
    });
  }
  buildMarkers();

  /* ---------- Raycasting for hover / click ---------- */
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2(-2, -2); // start off-screen
  let hoveredMarker = null;

  function setPointer(ev) {
    pointerNdc.x = (ev.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(ev.clientY / innerHeight) * 2 + 1;
  }
  renderer.domElement.addEventListener('pointermove', onMove);
  function onMove(ev) {
    setPointer(ev);
    document.body.style.cursor = hoveredMarker ? 'pointer' : '';
  }
  renderer.domElement.addEventListener('click', (ev) => {
    setPointer(ev);
    const hits = pick();
    if (hits && hits.length) selectCity(hits[0]);
  });

  function pick() {
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObjects(markers, false);
  }

  // DOM tooltip + info card
  const $tooltip = document.getElementById('tooltip');
  const $info = document.getElementById('info');
  const $iName = document.getElementById('info-name');
  const $iCoords = document.getElementById('info-coords');
  const $iDesc = document.getElementById('info-desc');

  function selectCity(marker) {
    const c = marker.userData.city;
    if (!c) return;
    $iName.textContent = '📍 ' + c.name;
    $iCoords.textContent =
      `坐标：${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'} , ` +
      `${Math.abs(c.lng).toFixed(2)}° ${c.lng >= 0 ? 'E' : 'W'}`;
    $iDesc.textContent = c.desc || '';
    $info.classList.remove('hidden');
    flyTo(marker.position);
  }
  document.getElementById('btn-close-info').addEventListener('click', () => {
    $info.classList.add('hidden');
  });

  /* ---------- Fly-to animation (smooth look at a point) ---------- */
  let flying = null;
  function flyTo(targetPos) {
    if (!controls) return;
    const start = controls.target.clone();
    const goal = targetPos.clone().multiplyScalar(0.98); // slightly inside surface
    const t0 = performance.now();
    const dur = 1400;
    flying = { start, goal };
    (function step() {
      if (!flying) return;
      const k = Math.min((performance.now() - t0) / dur, 1);
      const e = easeInOut(k);
      controls.target.lerpVectors(start, goal, e);
      if (k < 1) requestAnimationFrame(step);
    })();
  }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ---------- UI wiring ---------- */
  let autoRotate = true;
  const $btnRotate = document.getElementById('btn-rotate');
  const $speed = document.getElementById('speed');
  const $flyto = document.getElementById('flyto');

  $btnRotate.addEventListener('click', () => {
    autoRotate = !autoRotate;
    $btnRotate.classList.toggle('active', autoRotate);
  });
  if (controls) controls.autoRotateSpeed = 0.6;

  function resetView() {
    flying = null;
    if (!controls) return;
    camera.position.set(0, EARTH_RADIUS * 2.4, EARTH_RADIUS * 3.8);
    controls.target.set(0, 0, 0);
  }
  document.getElementById('btn-reset').addEventListener('click', resetView);

  $flyto.addEventListener('change', () => {
    const en = $flyto.value;
    if (!en) return;
    const c = CITIES.find((x) => x.en === en);
    if (c && markers.length) {
      selectCity(markers[CITIES.indexOf(c)]);
      $info.classList.remove('hidden');
    }
  });

  /* ---------- Window resize ---------- */
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ---------- Per-frame tooltip projection (hover) ---------- */
  function updateHover() {
    const hits = pick();
    hoveredMarker = hits && hits.length ? hits[0] : null;
    if (!hoveredMarker || !controls) {
      $tooltip.classList.add('hidden');
      return;
    }
    // project marker position to screen
    const v = hoveredMarker.position.clone().project(camera);
    if (v.z > 1 || v.z < -1) { $tooltip.classList.add('hidden'); return; }
    const x = ((v.x + 1) / 2) * innerWidth;
    const y = ((-v.y + 1) / 2) * innerHeight;
    const c = hoveredMarker.userData.city;
    $tooltip.textContent = `${c.name} (${c.en})`;
    $tooltip.style.left = x + 'px';
    $tooltip.style.top = (y - 12) + 'px';
    $tooltip.classList.remove('hidden');
  }

  /* ---------- Animation loop ---------- */
  function tick() {
    requestAnimationFrame(tick);

    // auto rotation of the globe itself
    if (autoRotate && earthGroup) {
      const sp = parseFloat($speed.value || '1') * 0.0006;
      earthGroup.rotation.y += sp;
      clouds.rotation.y += sp * 1.35; // clouds drift a bit faster
    }

    // gentle marker pulse
    markers.forEach((m, i) => {
      const s = EARTH_RADIUS * 0.018 + Math.sin(performance.now() / 500 + i) * 0.003;
      m.scale.setScalar(s);
    });

    updateHover();

    if (controls && controls.enableDamping) controls.update();
    renderer.render(scene, camera);
    hideLoader();
  }

  /* ---------- Start ---------- */
  let firstFrameDone = false;
  function hideLoader() {
    if (firstFrameDone) return;
    firstFrameDone = true;
    const el = document.getElementById('loader');
    console.log('[VEarth] first frame rendered, hiding loader');
    el.classList.add('done');            // fade out via CSS transition
    setTimeout(() => { el.style.display = 'none'; }, 700); // bulletproof fallback
  }
  tick();
  hideLoader();

})();
