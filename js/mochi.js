/*
 * 마스코트 "모찌" (Kora Motion 디자인 시스템)
 * - Mochi.svg(크기): 작은 2D 모찌 (깜빡이고 둥실거려요. 움직임은 css/style.css의 .mochi 부분)
 * - Mochi.mount3d(칸): 3D 모찌 (Three.js). 인터넷이 안 되면 2D 모찌로 대신 보여 줘요.
 * 색은 css/style.css의 --accent(몸), --mochi-cyan(빛), --mochi-pink(볼)을 따라가요.
 */
const Mochi = (() => {
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  let loading = null;

  // 2D 모찌 (SVG 그림)
  function svg(size = 64) {
    return `<svg class="mochi" width="${size}" height="${Math.round(size * 1.08)}" viewBox="0 0 240 260" role="img" aria-label="모찌 캐릭터">
      <ellipse class="m-shadow" cx="120" cy="240" rx="64" ry="9"/>
      <g class="m-rig">
        <rect class="m-body m-ear l" x="72" y="14" width="34" height="84" rx="17"/>
        <rect class="m-body m-ear r" x="134" y="14" width="34" height="84" rx="17"/>
        <rect class="m-body" x="36" y="70" width="168" height="150" rx="75"/>
        <ellipse class="m-shine" cx="76" cy="104" rx="16" ry="8" transform="rotate(-30 76 104)"/>
        <circle class="m-cheek" cx="70" cy="168" r="11"/><circle class="m-cheek" cx="170" cy="168" r="11"/>
        <g class="m-lid"><circle class="m-eye" cx="92" cy="146" r="15"/><circle class="m-eye" cx="148" cy="146" r="15"/>
          <circle class="m-pupil" cx="92" cy="146" r="7"/><circle class="m-pupil" cx="148" cy="146" r="7"/></g>
        <path d="M110 172 q10 9 20 0" fill="none" stroke="var(--bg)" stroke-width="4" stroke-linecap="round"/>
      </g></svg>`;
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (!loading) loading = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = THREE_URL; s.onload = ok; s.onerror = () => { loading = null; fail(new Error('three')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // 3D 모찌 (칸 안에 그려 넣기)
  function mount3d(box, h = 300) {
    box.style.height = h + 'px';
    box.innerHTML = svg(150); // 3D가 준비되기 전, 또는 실패했을 때 보이는 모습
    box.classList.add('mochi-fallback');
    loadThree().then(() => {
      if (!box.isConnected) return;
      try { build(box); box.classList.remove('mochi-fallback'); } catch (e) { /* 2D 모찌 유지 */ }
    }).catch(() => { /* 2D 모찌 유지 */ });
  }

  function build(box) {
    const css = getComputedStyle(document.documentElement);
    const col = n => new THREE.Color(css.getPropertyValue(n).trim());
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    box.innerHTML = ''; box.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.5, 7); camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 5); scene.add(key);
    const cy = new THREE.PointLight(col('--mochi-cyan'), 1.4, 20); cy.position.set(-4, 1, 3); scene.add(cy);
    const pk = new THREE.PointLight(col('--mochi-pink'), 1.2, 20); pk.position.set(4, -1, 3); scene.add(pk);

    const rig = new THREE.Group(); scene.add(rig);
    const fl = new THREE.Group(); rig.add(fl);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: col('--accent'), roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), bodyMat); body.scale.set(1.12, 1, 1); fl.add(body);

    const ear = (x, rz) => {
      const p = new THREE.Group(); p.position.set(x, 0.8, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 24), bodyMat); shaft.position.y = 0.45;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), bodyMat); tip.position.y = 0.9;
      p.add(shaft, tip); p.rotation.z = rz; fl.add(p); return p;
    };
    const earL = ear(-0.42, 0.12), earR = ear(0.42, -0.12);

    const eyeMat = new THREE.MeshStandardMaterial({ color: col('--bg'), roughness: 0.4 });
    const pupMat = new THREE.MeshStandardMaterial({ color: col('--text'), roughness: 0.3 });
    const eyes = new THREE.Group(); fl.add(eyes);
    const pupils = [];
    [-0.4, 0.4].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 24), eyeMat); e.position.set(x, 0.15, 0.86); e.scale.z = 0.55; eyes.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), pupMat); p.position.set(x, 0.15, 0.96); p.userData.home = { x, y: 0.15 };
      eyes.add(p); pupils.push(p);
    });
    const cheekMat = new THREE.MeshStandardMaterial({ color: col('--mochi-pink'), roughness: 0.6 });
    [-0.72, 0.72].forEach(x => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), cheekMat); c.position.set(x, -0.2, 0.72); c.scale.set(1, 0.7, 0.35); fl.add(c);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: col('--bg') }));
    mouth.rotation.z = Math.PI; mouth.position.set(0, -0.08, 0.98); fl.add(mouth);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: col('--accent'), transparent: true, opacity: 0.35 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.55; shadow.scale.set(1.1, 0.6, 1); scene.add(shadow);

    let mx = 0, my = 0, spin = 0, drag = false, lastX = 0;
    const cv = renderer.domElement;
    const onMove = e => {
      const r = cv.getBoundingClientRect();
      mx = Math.max(-1.5, Math.min(1.5, ((e.clientX - r.left) / r.width - 0.5) * 2));
      my = Math.max(-1.5, Math.min(1.5, ((e.clientY - r.top) / r.height - 0.5) * 2));
      if (drag) { spin += (e.clientX - lastX) * 0.01; lastX = e.clientX; }
    };
    const onUp = () => { drag = false; cv.style.cursor = 'grab'; };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    cv.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; cv.style.cursor = 'grabbing'; });
    cv.style.cursor = 'grab';

    const resize = () => {
      const w = box.clientWidth || 300, h = box.clientHeight || 300;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    addEventListener('resize', resize); resize();

    const clock = new THREE.Clock();
    const stop = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('resize', resize); renderer.dispose(); };
    (function frame() {
      if (!cv.isConnected) { stop(); return; } // 화면이 바뀌어 칸이 사라지면 멈춤
      const t = reduce ? 0 : clock.getElapsedTime();
      fl.position.y = Math.sin(t * 2) * 0.12;
      shadow.scale.x = 1.1 - Math.sin(t * 2) * 0.08;
      earL.rotation.z = 0.12 + Math.sin(t * 2.6) * 0.1;
      earR.rotation.z = -0.12 - Math.sin(t * 2.6 + 0.8) * 0.1;
      const ph = t % 4; eyes.scale.y = (ph > 3.85 && ph < 3.95) ? 0.1 : 1;
      if (!drag && Math.abs(spin) > 0.001) spin *= 0.94;
      rig.rotation.y += ((mx * 0.5 + spin) - rig.rotation.y) * 0.08;
      rig.rotation.x += (my * 0.25 - rig.rotation.x) * 0.08;
      pupils.forEach(p => {
        p.position.x += (p.userData.home.x + mx * 0.05 - p.position.x) * 0.15;
        p.position.y += (p.userData.home.y - my * 0.04 - p.position.y) * 0.15;
      });
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    })();
  }

  return { svg, mount3d };
})();
