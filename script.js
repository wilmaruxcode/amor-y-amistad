(function () {
  "use strict";

  // 1. Estado del juego
  const SCREENS = {
    HOME: "HOME",
    TURN: "TURN",
    DRAWING: "DRAWING",
    REVEAL: "REVEAL",
    FINISHED: "FINISHED",
  };

  const state = {
    screen: SCREENS.HOME,
    assignments: null,
    currentIndex: 0,
    timers: [],
    drawing: false,
  };

  const els = {};
  const fx = {
    renderer: null,
    scene: null,
    camera: null,
    bag: null,
    papers: [],
    drawnPaper: null,
    sparkles: null,
    hearts: null,
    clock: 0,
    shakeUntil: 0,
    celebrateUntil: 0,
    drawStart: 0,
    drawDuration: 2200,
  };

  // 2. Participantes
  const THEME_SONGS = Object.freeze({
    Sara: "audios/sara.mp3",
    Luciana: "audios/luciana.mp3",
    Heidy: "audios/heidy.mp3",
    Juanita: "audios/juanita.mp3",
    Mayerli: "audios/mayerli.mp3",
    Vecino: "audios/vecino.mp3",
    Guillermo: "audios/guillermo.mp3",
    Clara: "audios/clara.mp3",
    "Don Juan Pablo": "audios/don-juan-pablo.mp3",
    Paola: "audios/paola.mp3",
    Viviana: "audios/viviana.mp3",
    Majo: "audios/majo.mp3",
    Valeria: "audios/valeria.mp3",
    Nicolas: "audios/nicolas.mp3",
  });

  const PARTICIPANTS = Object.freeze([
    "Viviana",
    "Guillermo",
    "Vecino",
    "Clara",
    "Mayerli",
    "Heidy",
    "Don Juan Pablo",
    "Paola",
    "Nicolas",
    "Juanita",
    "Majo",
    "Valeria",
    "Sara",
    "Luciana",
  ]);

  function currentPlayer() {
    return PARTICIPANTS[state.currentIndex] || "";
  }

  function currentSecret() {
    const player = currentPlayer();
    return state.assignments ? state.assignments[player] : "";
  }

  function isLastPlayer() {
    return state.currentIndex >= PARTICIPANTS.length - 1;
  }

  // 3. Generación de asignaciones
  function randomInt(maxExclusive) {
    if (maxExclusive <= 1) {
      return 0;
    }

    const cryptoObj = window.crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      const limit = Math.floor(4294967296 / maxExclusive) * maxExclusive;
      const buffer = new Uint32Array(1);
      do {
        cryptoObj.getRandomValues(buffer);
      } while (buffer[0] >= limit);
      return buffer[0] % maxExclusive;
    }

    return Math.floor(Math.random() * maxExclusive);
  }

  function shuffleCopy(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function rotatedReceivers(ordered) {
    const shift = 1 + randomInt(Math.max(ordered.length - 1, 1));
    return ordered.map(function (_, index) {
      return ordered[(index + shift) % ordered.length];
    });
  }

  function toAssignments(givers, receivers) {
    const map = Object.create(null);
    givers.forEach(function (giver, index) {
      map[giver] = receivers[index];
    });
    return map;
  }

  function isDerangement(givers, receivers) {
    if (givers.length !== receivers.length) {
      return false;
    }
    for (let i = 0; i < givers.length; i += 1) {
      if (givers[i] === receivers[i]) {
        return false;
      }
    }
    return true;
  }

  function generateDerangement(people) {
    const givers = people.slice();
    const maxAttempts = 400;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const receivers = shuffleCopy(people);
      if (isDerangement(givers, receivers)) {
        return toAssignments(givers, receivers);
      }
    }

    const cycle = shuffleCopy(people);
    return toAssignments(cycle, rotatedReceivers(cycle));
  }

  // 4. Validación
  function validateAssignments(people, assignments) {
    if (!assignments) {
      return false;
    }

    const givers = Object.keys(assignments);
    const receivers = givers.map(function (name) {
      return assignments[name];
    });

    if (people.length !== 14 || givers.length !== 14 || receivers.length !== 14) {
      return false;
    }

    if (new Set(givers).size !== 14 || new Set(receivers).size !== 14) {
      return false;
    }

    for (let i = 0; i < people.length; i += 1) {
      const person = people[i];
      const secret = assignments[person];
      if (!secret || secret === person || people.indexOf(secret) === -1) {
        return false;
      }
    }

    return true;
  }

  function createFreshAssignments() {
    let assignments = generateDerangement(PARTICIPANTS);
    if (!validateAssignments(PARTICIPANTS, assignments)) {
      const cycle = shuffleCopy(PARTICIPANTS);
      assignments = toAssignments(cycle, rotatedReceivers(cycle));
    }
    if (!validateAssignments(PARTICIPANTS, assignments)) {
      return null;
    }
    return assignments;
  }

  // 5. Control de turnos
  function showScreen(name) {
    state.screen = name;

    const map = {
      HOME: els.home,
      TURN: els.turn,
      DRAWING: els.drawing,
      REVEAL: els.reveal,
      FINISHED: els.finished,
    };

    Object.keys(map).forEach(function (key) {
      const node = map[key];
      const active = key === name;
      node.hidden = !active;
      node.classList.toggle("is-active", active);
    });

    document.body.dataset.screen = name.toLowerCase();

    if (name !== SCREENS.REVEAL) {
      stopThemeSong();
    }
  }

  function renderTurn() {
    const name = currentPlayer();
    const first = state.currentIndex === 0;

    els.turnKicker.textContent = first ? "Es el turno de..." : "Ahora pásale el dispositivo a...";
    els.turnHeading.textContent = name.toUpperCase();
    els.turnHint.textContent = first
      ? "Pásale el dispositivo a " + name + "."
      : "Cuando estés listo, descubre tu papelito.";

    showScreen(SCREENS.TURN);
    els.btnDraw.focus();
  }

  function startSorteo() {
    const assignments = createFreshAssignments();
    if (!assignments) {
      return;
    }

    state.assignments = assignments;
    state.currentIndex = 0;
    state.drawing = false;
    clearTimers();
    clearReveal();
    resetPapers();
    renderTurn();
  }

  // 6. Animación de extracción
  function startDraw() {
    if (state.drawing || !state.assignments) {
      return;
    }

    state.drawing = true;
    els.btnDraw.disabled = true;
    showScreen(SCREENS.DRAWING);
    playDrawAnimation(function () {
      state.drawing = false;
      els.btnDraw.disabled = false;
      beginReveal();
    });
  }

  function playDrawAnimation(done) {
    fx.shakeUntil = performance.now() + 700;
    fx.drawStart = performance.now();
    fx.drawnPaper = fx.papers[Math.floor(Math.random() * fx.papers.length)] || null;

    later(fx.drawDuration, done);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // 7. Revelación
  function clearReveal() {
    els.slip.classList.remove("is-opening", "is-open");
    els.secretName.textContent = "";
    els.remember.hidden = true;
    els.btnContinue.hidden = true;
    els.slipTease.hidden = false;
  }

  function beginReveal() {
    clearReveal();
    showScreen(SCREENS.REVEAL);
    later(280, function () {
      els.slip.classList.add("is-opening");
    });
    later(980, function () {
      const secret = currentSecret();
      els.slip.classList.add("is-open");
      els.slipTease.hidden = true;
      els.secretName.textContent = "❤️ " + secret.toUpperCase() + " ❤️";
      els.remember.hidden = false;
      els.btnContinue.hidden = false;
      fx.celebrateUntil = performance.now() + 1400;
      playThemeSong(secret);
      els.btnContinue.focus();
    });
  }

  // 8. Cambio de participante
  function continueGame() {
    clearTimers();
    stopThemeSong();
    clearReveal();
    resetPapers();

    if (isLastPlayer()) {
      finishGame();
      return;
    }

    state.currentIndex += 1;
    renderTurn();
  }

  // 9. Pantalla final
  function finishGame() {
    state.assignments = null;
    state.drawing = false;
    fx.celebrateUntil = performance.now() + 4000;
    showScreen(SCREENS.FINISHED);
    els.btnReplay.focus();
  }

  // 10. Reinicio
  function playAgain() {
    clearTimers();
    clearReveal();
    resetPapers();
    startSorteo();
  }

  function playThemeSong(personName) {
    if (!els.themeAudio) {
      return;
    }

    const src = THEME_SONGS[personName];
    if (!src) {
      stopThemeSong();
      return;
    }

    const fullSrc = new URL(src, window.location.href).href;
    if (!els.themeAudio.src || els.themeAudio.src !== fullSrc) {
      els.themeAudio.src = src;
    }

    els.themeAudio.currentTime = 0;
    const playPromise = els.themeAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  }

  function stopThemeSong() {
    if (!els.themeAudio) {
      return;
    }
    els.themeAudio.pause();
    els.themeAudio.currentTime = 0;
  }

  function later(ms, fn) {
    const id = window.setTimeout(fn, ms);
    state.timers.push(id);
    return id;
  }

  function clearTimers() {
    state.timers.forEach(function (id) {
      window.clearTimeout(id);
    });
    state.timers = [];
  }

  // 11. Three.js
  function makeTexture(draw) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    draw(canvas.getContext("2d"));
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function sparkleTexture() {
    return makeTexture(function (ctx) {
      const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 28);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.4, "rgba(255,214,170,0.55)");
      g.addColorStop(1, "rgba(255,214,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
  }

  function heartTexture() {
    return makeTexture(function (ctx) {
      ctx.translate(32, 34);
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-18, -6, -16, -22, 0, -14);
      ctx.bezierCurveTo(16, -22, 18, -6, 0, 8);
      ctx.fillStyle = "#d45c7c";
      ctx.fill();
    });
  }

  function createBag() {
    const group = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x9c3354,
      roughness: 0.42,
      metalness: 0.16,
    });
    const lining = new THREE.MeshStandardMaterial({
      color: 0x3f1524,
      roughness: 0.82,
      metalness: 0.04,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xddbf74,
      roughness: 0.22,
      metalness: 0.62,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: 0xf7e4c6,
      roughness: 0.55,
      metalness: 0.08,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.4, 1.95, 40, 1, true), cloth);
    body.position.y = -0.1;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), cloth);
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -1.07;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.24, 32), lining);
    inner.position.y = 0.72;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.08, 14, 40), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.82;
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.045, 10, 32), cream);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.12;
    const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), gold);
    bowL.scale.set(1.4, 0.55, 0.7);
    bowL.position.set(-0.18, 0.96, 1.08);
    const bowR = bowL.clone();
    bowR.position.x = 0.18;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), gold);
    knot.position.set(0, 0.96, 1.14);

    group.add(body, bottom, inner, rim, band, bowL, bowR, knot);
    group.position.set(0, -1.18, 0);
    return group;
  }

  function createPapers() {
    const papers = [];
    const colors = [0xfff6ea, 0xffe4ec, 0xffefd2, 0xf8d5de, 0xfff1dc];
    const geometry = new THREE.BoxGeometry(0.4, 0.54, 0.018);

    for (let i = 0; i < 18; i += 1) {
      const paper = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: colors[i % colors.length],
          roughness: 0.72,
          metalness: 0.02,
        })
      );
      paper.userData.home = {
        x: (Math.random() - 0.5) * 1.15,
        y: 0.58 + Math.random() * 0.48,
        z: (Math.random() - 0.5) * 0.95,
        rx: (Math.random() - 0.5) * 0.8,
        ry: (Math.random() - 0.5) * 1.4,
        rz: (Math.random() - 0.5) * 0.8,
      };
      paper.position.set(paper.userData.home.x, paper.userData.home.y, paper.userData.home.z);
      paper.rotation.set(paper.userData.home.rx, paper.userData.home.ry, paper.userData.home.rz);
      fx.bag.add(paper);
      papers.push(paper);
    }

    return papers;
  }

  function createPoints(count, texture, size, color) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: texture,
      size: size,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: color,
      opacity: 0.7,
    });
    return new THREE.Points(geometry, material);
  }

  function resetPapers() {
    fx.drawnPaper = null;
    fx.papers.forEach(function (paper) {
      const home = paper.userData.home;
      paper.position.set(home.x, home.y, home.z);
      paper.rotation.set(home.rx, home.ry, home.rz);
      paper.visible = true;
    });
  }

  function resizeScene() {
    if (!fx.renderer || !fx.camera) {
      return;
    }
    const width = window.innerWidth;
    const height = Math.max(window.innerHeight, 1);
    fx.camera.aspect = width / height;
    fx.camera.updateProjectionMatrix();
    fx.renderer.setSize(width, height, false);
    fx.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function updateDrawMotion(now) {
    if (!fx.drawnPaper || state.screen !== SCREENS.DRAWING) {
      return;
    }

    const t = Math.min(1, (now - fx.drawStart) / fx.drawDuration);
    const e = easeOutCubic(t);
    const home = fx.drawnPaper.userData.home;
    fx.drawnPaper.position.set(
      home.x * (1 - e),
      home.y + e * 2.35,
      home.z * (1 - e) + e * 2.4
    );
    fx.drawnPaper.rotation.set(home.rx * (1 - e), home.ry * (1 - e), home.rz * (1 - e));
  }

  function driftPoints(points, speed) {
    const positions = points.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) + speed;
      if (y > 5.5) {
        y = -5.5;
        positions.setX(i, (Math.random() - 0.5) * 12);
      }
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
  }

  function animate(now) {
    window.requestAnimationFrame(animate);
    fx.clock = now;

    if (fx.bag) {
      const shaking = now < fx.shakeUntil;
      fx.bag.rotation.z = shaking ? Math.sin(now / 40) * 0.12 : Math.sin(now / 700) * 0.03;
      fx.bag.rotation.x = shaking ? Math.sin(now / 50) * 0.08 : 0.08;
      fx.bag.position.y = -1.15 + Math.sin(now / 650) * 0.04;
    }

    fx.papers.forEach(function (paper, index) {
      if (paper === fx.drawnPaper) {
        return;
      }
      paper.rotation.y += 0.004 + index * 0.0002;
      paper.position.y = paper.userData.home.y + Math.sin(now / 400 + index) * 0.05;
    });

    updateDrawMotion(now);

    if (fx.sparkles) {
      driftPoints(fx.sparkles, 0.01);
      fx.sparkles.rotation.y += 0.0008;
    }

    if (fx.hearts) {
      const celebrating = now < fx.celebrateUntil || state.screen === SCREENS.FINISHED;
      driftPoints(fx.hearts, celebrating ? 0.035 : 0.008);
      fx.hearts.material.opacity = celebrating ? 0.95 : 0.28;
    }

    fx.renderer.render(fx.scene, fx.camera);
  }

  function initThree() {
    if (typeof THREE === "undefined") {
      return;
    }

    fx.scene = new THREE.Scene();
    fx.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
    fx.camera.position.set(0, 0.55, 6.2);

    fx.renderer = new THREE.WebGLRenderer({
      canvas: els.canvas,
      alpha: true,
      antialias: true,
    });
    fx.renderer.setClearColor(0x000000, 0);
    resizeScene();

    const ambient = new THREE.AmbientLight(0xfff3f6, 1.05);
    const key = new THREE.PointLight(0xfff4e8, 1.35, 22);
    key.position.set(2.2, 3.6, 4.8);
    const fill = new THREE.PointLight(0xffb7c9, 0.7, 18);
    fill.position.set(-3.2, 1.4, 2.2);
    const rimLight = new THREE.PointLight(0xffe3a8, 0.45, 14);
    rimLight.position.set(0, -1.4, 3);
    fx.scene.add(ambient, key, fill, rimLight);

    fx.bag = createBag();
    fx.papers = createPapers();
    fx.sparkles = createPoints(64, sparkleTexture(), 0.24, 0xffe0c4);
    fx.hearts = createPoints(28, heartTexture(), 0.46, 0xffffff);
    fx.hearts.material.opacity = 0.28;

    fx.scene.add(fx.bag, fx.sparkles, fx.hearts);

    window.addEventListener("resize", resizeScene);
    window.requestAnimationFrame(animate);
  }

  // 12. Inicialización
  function cacheElements() {
    els.canvas = document.getElementById("scene-canvas");
    els.home = document.getElementById("screen-home");
    els.turn = document.getElementById("screen-turn");
    els.drawing = document.getElementById("screen-drawing");
    els.reveal = document.getElementById("screen-reveal");
    els.finished = document.getElementById("screen-finished");
    els.btnStart = document.getElementById("btn-start");
    els.turnKicker = document.getElementById("turn-kicker");
    els.turnHeading = document.getElementById("turn-heading");
    els.turnHint = document.getElementById("turn-hint");
    els.btnDraw = document.getElementById("btn-draw");
    els.slip = document.getElementById("slip");
    els.slipTease = document.getElementById("slip-tease");
    els.secretName = document.getElementById("secret-name");
    els.remember = document.getElementById("remember");
    els.btnContinue = document.getElementById("btn-continue");
    els.btnReplay = document.getElementById("btn-replay");
    els.themeAudio = document.getElementById("theme-audio");
  }

  function bindEvents() {
    els.btnStart.addEventListener("click", startSorteo);
    els.btnDraw.addEventListener("click", startDraw);
    els.btnContinue.addEventListener("click", continueGame);
    els.btnReplay.addEventListener("click", playAgain);
  }

  function init() {
    cacheElements();
    bindEvents();
    initThree();
    showScreen(SCREENS.HOME);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
