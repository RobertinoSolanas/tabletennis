// ============================================================
// 🏓 ROBOT TABLE TENNIS - 3D Game Engine
// Pure HTML/CSS/JS with Three.js
// ============================================================

// ===== CONSTANTS =====
const TABLE_LENGTH = 8;
const TABLE_WIDTH = 4.4;
const TABLE_HEIGHT = 2.2;
const TABLE_THICKNESS = 0.15;
const NET_HEIGHT = 0.5;
const NET_THICKNESS = 0.03;
const BALL_RADIUS = 0.08;
const PADDLE_RADIUS = 0.55;
const PADDLE_THICKNESS = 0.06;
const GRAVITY = -9.0;
const BALL_BOUNCE_TABLE = 0.92;
const BALL_BOUNCE_PADDLE = 0.95;
const AIR_RESISTANCE = 0.998;
const SPIN_FACTOR = 0.2;
const MAX_BALL_SPEED = 16;
const SERVE_SPEED = 8;

// ===== AUDIO ENGINE (Web Audio API - no external files) =====
var audioCtx = null;
var audioEnabled = true;
var masterGain = null;
var ambientSource = null;
var ambientGain = null;

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(audioCtx.destination);

        // Start ambient crowd noise
        startAmbientCrowd();
    } catch (e) {
        console.warn('Web Audio API not available:', e);
        audioEnabled = false;
    }
}

function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// --- Paddle Hit Sound (sharp "tok") ---
function playPaddleHit(power) {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;
    var vol = 0.3 + power * 0.2;

    // Sharp attack noise burst
    var bufLen = audioCtx.sampleRate * 0.06;
    var buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufLen; i++) {
        var env = Math.exp(-i / (bufLen * 0.15));
        data[i] = (Math.random() * 2 - 1) * env;
    }

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to shape the "tok" sound
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000 + power * 1500;
    filter.Q.value = 2.0;

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.08);

    // Add a "woody" tone
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + power * 400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);

    var oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(vol * 0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
}

// --- Table Bounce Sound (lighter "tick") ---
function playTableBounce() {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    // Short noise burst
    var bufLen = audioCtx.sampleRate * 0.04;
    var buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufLen; i++) {
        var env = Math.exp(-i / (bufLen * 0.1));
        data[i] = (Math.random() * 2 - 1) * env;
    }

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Higher frequency bandpass for table "tick"
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4500;
    filter.Q.value = 3.0;

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.05);

    // Subtle resonant ping
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);

    var oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.15, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
}

// --- Net Hit Sound (dull thud) ---
function playNetHit() {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    // Low-frequency thud
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);

    // Mesh rattle noise
    var bufLen = audioCtx.sampleRate * 0.15;
    var buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufLen; i++) {
        var env = Math.exp(-i / (bufLen * 0.3));
        data[i] = (Math.random() * 2 - 1) * env * 0.3;
    }

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    var nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.2, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.15);
}

// --- Point Scored Sound (ascending chime) ---
function playPointScored() {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    var notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, t + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.1);
        osc.stop(t + i * 0.1 + 0.35);
    });
}

// --- Serve Sound (whoosh + hit) ---
function playServeSound() {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    // Whoosh
    var bufLen = audioCtx.sampleRate * 0.2;
    var buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufLen; i++) {
        var p = i / bufLen;
        var env = Math.sin(p * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.3;
    }

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
    filter.Q.value = 1.5;

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.2);

    // Delayed paddle hit
    setTimeout(function () { playPaddleHit(0.8); }, 50);
}

// --- Set/Match Win Fanfare ---
function playWinFanfare() {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    var notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        var gain = audioCtx.createGain();
        var start = t + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
        gain.gain.setValueAtTime(0.25, start + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.55);
    });

    // Final sustain chord
    [523, 659, 784, 1047].forEach(function (freq) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        var gain = audioCtx.createGain();
        var start = t + 0.6;
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 1.0);
    });
}

// --- Rally Milestone Sound (short ascending note) ---
function playRallyMilestone(count) {
    if (!audioCtx || !audioEnabled) return;
    var t = audioCtx.currentTime;

    var baseFreq = 400 + Math.min(count, 20) * 30;
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.2, t + 0.08);

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
}

// --- Ambient Crowd Noise ---
function startAmbientCrowd() {
    if (!audioCtx || !audioEnabled) return;

    // Low rumble crowd noise using filtered noise
    var bufLen = audioCtx.sampleRate * 4;
    var buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);

    // Generate brownian noise for crowd rumble
    var lastVal = 0;
    for (var i = 0; i < bufLen; i++) {
        var white = Math.random() * 2 - 1;
        lastVal = (lastVal + 0.02 * white) / 1.02;
        data[i] = lastVal * 3.5;
    }

    ambientSource = audioCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.08;

    ambientSource.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(masterGain);
    ambientSource.start();
}

// --- Crowd React (brief swell on exciting moments) ---
function crowdReact(intensity) {
    if (!audioCtx || !audioEnabled || !ambientGain) return;
    var t = audioCtx.currentTime;
    var target = 0.08 + intensity * 0.15;
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
    ambientGain.gain.linearRampToValueAtTime(target, t + 0.1);
    ambientGain.gain.linearRampToValueAtTime(0.08, t + 1.5);
}

function toggleSound() {
    audioEnabled = !audioEnabled;
    if (masterGain) {
        masterGain.gain.value = audioEnabled ? 0.6 : 0;
    }
    document.getElementById('btn-sound').textContent = audioEnabled ? '🔊' : '🔇';
}

// ===== GAME STATE =====
// Shot types enum
var SHOT = { FLAT: 'flat', TOPSPIN: 'topspin', BACKSPIN: 'backspin', LOB: 'lob', SMASH: 'smash', DROP: 'drop' };

const state = {
    paused: false,
    gameSpeed: 1,
    cameraMode: 0,
    cameraModes: ['side', 'top', 'player1', 'player2', 'cinematic'],
    scores: { left: 0, right: 0 },
    sets: { left: 0, right: 0 },
    serving: 'left',
    serveCount: 0,
    rallyCount: 0,
    ballInPlay: false,
    lastHitBy: null,
    lastBounceOnSide: null,
    bounceCount: 0,
    bouncesThisSide: 0,       // Track consecutive bounces on same side
    servePhase: 0,
    serveTimer: 0,
    serveBounceOnServerSide: false,  // Has serve bounced on server's side?
    serveBounceOnReceiverSide: false, // Has serve bounced on receiver's side?
    isServeReturn: false,      // Is the next hit the serve return?
    pointPause: 0,
    maxScore: 11,
    matchSets: 3,
    deuce: false,              // True when score reaches 10-10
    lastShotType: null,        // Track what shot was last played
    edgeBall: false            // Track if ball hit edge
};

// ===== THREE.JS SETUP =====
var scene, camera, renderer, clock;
var table, net, ball, ballGlow;
var ambientLight, dirLight;

// Ball physics
var ballPos = new THREE.Vector3(0, TABLE_HEIGHT + 1, 0);
var ballVel = new THREE.Vector3(0, 0, 0);
var ballSpin = new THREE.Vector3(0, 0, 0);

// Robot state
var robots = {
    left: {
        pos: new THREE.Vector3(0, 0, -TABLE_LENGTH / 2 - 1.2),
        paddlePos: new THREE.Vector3(0, TABLE_HEIGHT + 0.7, -TABLE_LENGTH / 2 - 0.6),
        paddleTarget: new THREE.Vector3(0, TABLE_HEIGHT + 0.7, -TABLE_LENGTH / 2 - 0.6),
        paddleVel: new THREE.Vector3(0, 0, 0),
        swinging: false,
        swingTime: 0,
        bodyAngle: 0,
        style: 'aggressive',
        reactionSpeed: 0.32,
        accuracy: 0.96,
        power: 1.0,
        spinAbility: 0.75,
        color: 0xff3333,
        mesh: null,
        celebrating: false,
        celebrateTime: 0,
        // Enhanced AI attributes
        name: 'ROBO-RED',
        missChance: 0.03,         // 3% chance to miss a returnable ball
        fatigue: 0,               // Increases during long rallies
        maxFatigue: 1.0,
        preferredShots: {         // Weight for each shot type (higher = more likely)
            topspin: 0.35,
            flat: 0.25,
            smash: 0.25,
            backspin: 0.05,
            lob: 0.05,
            drop: 0.05
        },
        shotQuality: 0.9,         // Overall consistency
        smashThreshold: 0.6,      // Ball height above table to attempt smash
        serveVariety: 0.7,        // How varied the serves are
        positioning: 'close'      // 'close' or 'back'
    },
    right: {
        pos: new THREE.Vector3(0, 0, TABLE_LENGTH / 2 + 1.2),
        paddlePos: new THREE.Vector3(0, TABLE_HEIGHT + 0.7, TABLE_LENGTH / 2 + 0.6),
        paddleTarget: new THREE.Vector3(0, TABLE_HEIGHT + 0.7, TABLE_LENGTH / 2 + 0.6),
        paddleVel: new THREE.Vector3(0, 0, 0),
        swinging: false,
        swingTime: 0,
        bodyAngle: Math.PI,
        style: 'defensive',
        reactionSpeed: 0.32,
        accuracy: 0.97,
        power: 0.85,
        spinAbility: 0.95,
        color: 0x3366ff,
        mesh: null,
        celebrating: false,
        celebrateTime: 0,
        // Enhanced AI attributes
        name: 'ROBO-BLUE',
        missChance: 0.02,         // 2% chance to miss
        fatigue: 0,
        maxFatigue: 1.0,
        preferredShots: {
            topspin: 0.15,
            flat: 0.15,
            smash: 0.05,
            backspin: 0.30,
            lob: 0.20,
            drop: 0.15
        },
        shotQuality: 0.92,
        smashThreshold: 0.8,
        serveVariety: 0.5,
        positioning: 'back'
    }
};

var cameraTarget = new THREE.Vector3(0, TABLE_HEIGHT, 0);
var particles = [];
var particleGroup;
var trailMeshes = [];
var MAX_TRAIL = 12;
var pointAwarded = false;

// ===== INITIALIZATION =====
function init() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);

    var canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(8, 7, 0);
    camera.lookAt(cameraTarget);

    createLighting();
    createArena();
    createTable();
    createNet();
    createBall();
    createRobot('left');
    createRobot('right');
    particleGroup = new THREE.Group();
    scene.add(particleGroup);

    window.addEventListener('resize', onResize);
    setupControls();

    // Initialize audio on first user interaction
    document.addEventListener('click', function audioInit() {
        initAudio();
        document.removeEventListener('click', audioInit);
    }, { once: true });

    setTimeout(function () {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);

    setTimeout(function () {
        startServe();
    }, 2500);

    animate();
}

// ===== LIGHTING =====
function createLighting() {
    ambientLight = new THREE.AmbientLight(0x334466, 0.5);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(5, 15, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    var spot1 = new THREE.SpotLight(0xff4444, 0.6, 30, Math.PI / 5, 0.5);
    spot1.position.set(-6, 12, -4);
    spot1.target.position.set(0, TABLE_HEIGHT, -2);
    scene.add(spot1);
    scene.add(spot1.target);

    var spot2 = new THREE.SpotLight(0x4488ff, 0.6, 30, Math.PI / 5, 0.5);
    spot2.position.set(6, 12, 4);
    spot2.target.position.set(0, TABLE_HEIGHT, 2);
    scene.add(spot2);
    scene.add(spot2.target);

    var rim1 = new THREE.PointLight(0xff6644, 0.4, 20);
    rim1.position.set(-8, 5, 0);
    scene.add(rim1);

    var rim2 = new THREE.PointLight(0x4466ff, 0.4, 20);
    rim2.position.set(8, 5, 0);
    scene.add(rim2);

    var tglow = new THREE.PointLight(0x224488, 0.3, 8);
    tglow.position.set(0, 0.5, 0);
    scene.add(tglow);
}

// ===== ARENA =====
function createArena() {
    var floorGeo = new THREE.PlaneGeometry(60, 60);
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.8, metalness: 0.2 });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    var grid = new THREE.GridHelper(40, 40, 0x1a1a3a, 0x1a1a3a);
    grid.position.y = 0.01;
    scene.add(grid);

    var bMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.6 });
    [-1, 1].forEach(function (s) {
        var b1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 14), bMat);
        b1.position.set(s * 5, 0.75, 0);
        scene.add(b1);
        var b2 = new THREE.Mesh(new THREE.BoxGeometry(10.1, 1.5, 0.1), bMat);
        b2.position.set(0, 0.75, s * 7);
        scene.add(b2);
    });

    for (var i = -2; i <= 2; i++) {
        var lf = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.1, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeedd, emissiveIntensity: 0.5 })
        );
        lf.position.set(i * 3, 11, 0);
        scene.add(lf);
    }
}

// ===== TABLE =====
function createTable() {
    var g = new THREE.Group();

    var surfMat = new THREE.MeshStandardMaterial({ color: 0x0d5e2e, roughness: 0.35, metalness: 0.05 });
    var surf = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICKNESS, TABLE_LENGTH), surfMat);
    surf.position.y = TABLE_HEIGHT;
    surf.castShadow = true;
    surf.receiveShadow = true;
    g.add(surf);

    var lMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.1 });
    [-1, 1].forEach(function (s) {
        var el = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH + 0.02, 0.005, 0.04), lMat);
        el.position.set(0, TABLE_HEIGHT + TABLE_THICKNESS / 2 + 0.003, s * TABLE_LENGTH / 2);
        g.add(el);
        var sl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, TABLE_LENGTH + 0.02), lMat);
        sl.position.set(s * TABLE_WIDTH / 2, TABLE_HEIGHT + TABLE_THICKNESS / 2 + 0.003, 0);
        g.add(sl);
    });

    var cl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, TABLE_LENGTH + 0.02), lMat);
    cl.position.set(0, TABLE_HEIGHT + TABLE_THICKNESS / 2 + 0.003, 0);
    g.add(cl);

    var legMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.4, metalness: 0.6 });
    var lps = [
        [-TABLE_WIDTH / 2 + 0.15, -TABLE_LENGTH / 2 + 0.15],
        [TABLE_WIDTH / 2 - 0.15, -TABLE_LENGTH / 2 + 0.15],
        [-TABLE_WIDTH / 2 + 0.15, TABLE_LENGTH / 2 - 0.15],
        [TABLE_WIDTH / 2 - 0.15, TABLE_LENGTH / 2 - 0.15]
    ];
    lps.forEach(function (p) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, TABLE_HEIGHT - TABLE_THICKNESS / 2, 8), legMat);
        leg.position.set(p[0], (TABLE_HEIGHT - TABLE_THICKNESS / 2) / 2, p[1]);
        leg.castShadow = true;
        g.add(leg);
        var base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8), legMat);
        base.position.set(p[0], 0.025, p[1]);
        g.add(base);
    });

    var trMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, roughness: 0.3, metalness: 0.7 });
    [-1, 1].forEach(function (s) {
        var t1 = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH + 0.1, 0.06, 0.06), trMat);
        t1.position.set(0, TABLE_HEIGHT - TABLE_THICKNESS / 2 + 0.03, s * (TABLE_LENGTH / 2 + 0.03));
        g.add(t1);
        var t2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, TABLE_LENGTH + 0.16), trMat);
        t2.position.set(s * (TABLE_WIDTH / 2 + 0.03), TABLE_HEIGHT - TABLE_THICKNESS / 2 + 0.03, 0);
        g.add(t2);
    });

    table = g;
    scene.add(g);
}

// ===== NET =====
function createNet() {
    var g = new THREE.Group();
    var pMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.8 });
    [-1, 1].forEach(function (s) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, NET_HEIGHT + 0.1, 8), pMat);
        post.position.set(s * (TABLE_WIDTH / 2 + 0.12), TABLE_HEIGHT + NET_HEIGHT / 2 + 0.05, 0);
        post.castShadow = true;
        g.add(post);
        var clamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), pMat);
        clamp.position.set(s * (TABLE_WIDTH / 2 + 0.12), TABLE_HEIGHT + 0.03, 0);
        g.add(clamp);
    });

    var nc = document.createElement('canvas');
    nc.width = 128;
    nc.height = 64;
    var ctx = nc.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = 'rgba(200,200,220,0.6)';
    ctx.lineWidth = 0.5;
    for (var x = 0; x < 128; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke(); }
    for (var y = 0; y < 64; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }

    var nTex = new THREE.CanvasTexture(nc);
    var nMat = new THREE.MeshStandardMaterial({ map: nTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.9 });
    var nMesh = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_WIDTH + 0.24, NET_HEIGHT), nMat);
    nMesh.position.set(0, TABLE_HEIGHT + NET_HEIGHT / 2 + TABLE_THICKNESS / 2, 0);
    g.add(nMesh);

    var bMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05 });
    var band = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH + 0.24, 0.03, NET_THICKNESS), bMat);
    band.position.set(0, TABLE_HEIGHT + NET_HEIGHT + TABLE_THICKNESS / 2, 0);
    g.add(band);

    net = g;
    scene.add(g);
}

// ===== BALL =====
function createBall() {
    var bGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
    var bMat = new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.3, metalness: 0.1, emissive: 0xff6600, emissiveIntensity: 0.15 });
    ball = new THREE.Mesh(bGeo, bMat);
    ball.castShadow = true;
    ball.position.copy(ballPos);
    scene.add(ball);

    var gGeo = new THREE.SphereGeometry(BALL_RADIUS * 2.5, 16, 16);
    var gMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.1 });
    ballGlow = new THREE.Mesh(gGeo, gMat);
    ball.add(ballGlow);
}

// ===== ROBOTS =====
function createRobot(side) {
    var r = robots[side];
    var group = new THREE.Group();
    var color = r.color;

    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.3, metalness: 0.8 });
    var accentMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.6, emissive: color, emissiveIntensity: 0.2 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.2, metalness: 0.9 });

    // Torso
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
    torso.position.y = 1.6;
    torso.castShadow = true;
    group.add(torso);

    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.52), accentMat);
    chest.position.y = 1.8;
    group.add(chest);

    // Head
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.4), bodyMat);
    head.position.y = 2.35;
    head.castShadow = true;
    group.add(head);

    var visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.12, 0.05),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 })
    );
    visor.position.set(0, 2.38, 0.23);
    group.add(visor);

    // Antenna
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), accentMat);
    ant.position.set(0.1, 2.7, 0);
    group.add(ant);
    var antTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.0 })
    );
    antTip.position.set(0.1, 2.82, 0);
    group.add(antTip);

    // Shoulders
    [-1, 1].forEach(function (s) {
        var sh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), darkMat);
        sh.position.set(s * 0.55, 2.0, 0);
        group.add(sh);
    });

    // Left arm (non-paddle)
    var leftArm = new THREE.Group();
    var uaL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), bodyMat);
    uaL.position.y = -0.25;
    leftArm.add(uaL);
    var elL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkMat);
    elL.position.y = -0.5;
    leftArm.add(elL);
    var faL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), bodyMat);
    faL.position.y = -0.75;
    leftArm.add(faL);
    leftArm.position.set(-0.55, 2.0, 0);
    leftArm.rotation.z = 0.2;
    group.add(leftArm);

    // Right arm (paddle arm)
    var rightArm = new THREE.Group();
    rightArm.name = 'paddleArm';
    var uaR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), bodyMat);
    uaR.position.y = -0.25;
    rightArm.add(uaR);
    var elR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkMat);
    elR.position.y = -0.5;
    rightArm.add(elR);
    var faR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), bodyMat);
    faR.position.y = -0.75;
    rightArm.add(faR);

    // Paddle
    var paddle = new THREE.Group();
    paddle.name = 'paddle';
    var handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.035, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0x886633, roughness: 0.6 })
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.12;
    paddle.add(handle);

    var pColor = color === 0xff3333 ? 0xcc0000 : 0x0044cc;
    var pFace = new THREE.Mesh(
        new THREE.CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, PADDLE_THICKNESS, 24),
        new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.7, metalness: 0.05 })
    );
    pFace.rotation.x = Math.PI / 2;
    pFace.position.z = 0.35;
    paddle.add(pFace);

    var pBack = new THREE.Mesh(
        new THREE.CylinderGeometry(PADDLE_RADIUS - 0.01, PADDLE_RADIUS - 0.01, 0.01, 24),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    pBack.rotation.x = Math.PI / 2;
    pBack.position.z = 0.32;
    paddle.add(pBack);

    paddle.position.set(0, -1.0, 0);
    rightArm.add(paddle);
    rightArm.position.set(0.55, 2.0, 0);
    group.add(rightArm);

    // Waist
    var waist = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.15, 8), darkMat);
    waist.position.y = 1.12;
    group.add(waist);

    // Legs
    [-1, 1].forEach(function (s) {
        var hip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), darkMat);
        hip.position.set(s * 0.25, 1.05, 0);
        group.add(hip);
        var ul = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.5, 8), bodyMat);
        ul.position.set(s * 0.25, 0.75, 0);
        group.add(ul);
        var knee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkMat);
        knee.position.set(s * 0.25, 0.5, 0);
        group.add(knee);
        var ll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), bodyMat);
        ll.position.set(s * 0.25, 0.25, 0);
        group.add(ll);
        var foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.25), darkMat);
        foot.position.set(s * 0.25, 0.03, 0.05);
        group.add(foot);
    });

    group.position.copy(r.pos);
    group.scale.set(1.2, 1.35, 1.2);
    group.rotation.y = r.bodyAngle;

    group.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    r.mesh = group;
    scene.add(group);
}

// ===== PARTICLES =====
function spawnHitParticles(position, color, count) {
    for (var i = 0; i < count; i++) {
        var geo = new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 6, 6);
        var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
        var p = new THREE.Mesh(geo, mat);
        p.position.copy(position);
        var vel = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 3
        );
        particles.push({ mesh: p, velocity: vel, life: 1.0, decay: 0.02 + Math.random() * 0.02 });
        particleGroup.add(p);
    }
}

function spawnBounceParticles(position) {
    for (var i = 0; i < 5; i++) {
        var geo = new THREE.RingGeometry(0.01, 0.03, 8);
        var mat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        var p = new THREE.Mesh(geo, mat);
        p.position.copy(position);
        p.position.y = TABLE_HEIGHT + TABLE_THICKNESS / 2 + 0.01;
        p.rotation.x = -Math.PI / 2;
        particles.push({ mesh: p, velocity: new THREE.Vector3(0, 0, 0), life: 0.5, decay: 0.025, isRing: true, scale: 1 });
        particleGroup.add(p);
    }
}

function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= p.decay;
        if (p.isRing) {
            p.scale += dt * 4;
            p.mesh.scale.set(p.scale, p.scale, p.scale);
        } else {
            p.velocity.y -= 9.8 * dt;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
        }
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) {
            particleGroup.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ===== BALL TRAIL =====
function updateBallTrail() {
    if (state.ballInPlay) {
        var tGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.5, 6, 6);
        var tMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.3 });
        var tMesh = new THREE.Mesh(tGeo, tMat);
        tMesh.position.copy(ball.position);
        scene.add(tMesh);
        trailMeshes.push({ mesh: tMesh, life: 1.0 });
    }
    for (var i = trailMeshes.length - 1; i >= 0; i--) {
        trailMeshes[i].life -= 0.06;
        trailMeshes[i].mesh.material.opacity = trailMeshes[i].life * 0.3;
        trailMeshes[i].mesh.scale.setScalar(trailMeshes[i].life);
        if (trailMeshes[i].life <= 0) {
            scene.remove(trailMeshes[i].mesh);
            trailMeshes[i].mesh.geometry.dispose();
            trailMeshes[i].mesh.material.dispose();
            trailMeshes.splice(i, 1);
        }
    }
    while (trailMeshes.length > MAX_TRAIL) {
        scene.remove(trailMeshes[0].mesh);
        trailMeshes[0].mesh.geometry.dispose();
        trailMeshes[0].mesh.material.dispose();
        trailMeshes.shift();
    }
}

// ===== SERVE =====
function startServe() {
    state.ballInPlay = false;
    state.servePhase = 0;
    state.serveTimer = 0;
    state.rallyCount = 0;
    state.bounceCount = 0;
    state.bouncesThisSide = 0;
    state.lastHitBy = null;
    state.lastBounceOnSide = null;
    state.serveBounceOnServerSide = false;
    state.serveBounceOnReceiverSide = false;
    state.isServeReturn = true;
    state.lastShotType = null;
    state.edgeBall = false;
    pointAwarded = false;

    // Reset celebration
    robots.left.celebrating = false;
    robots.left.celebrateTime = 0;
    robots.right.celebrating = false;
    robots.right.celebrateTime = 0;

    // Reset fatigue between points slightly
    robots.left.fatigue = Math.max(0, robots.left.fatigue - 0.1);
    robots.right.fatigue = Math.max(0, robots.right.fatigue - 0.1);

    var server = robots[state.serving];
    var towardOpponent = state.serving === 'left' ? 1 : -1;

    ballPos.set(server.pos.x + 0.3, TABLE_HEIGHT + 0.6, server.pos.z + towardOpponent * 0.5);
    ballVel.set(0, 0, 0);
    ballSpin.set(0, 0, 0);
    ball.position.copy(ballPos);

    updateServingIndicator();
    updateUI();
}

function updateServe(dt) {
    var server = robots[state.serving];
    // Direction TOWARD opponent: left player hits toward +z, right toward -z
    var towardOpponent = state.serving === 'left' ? 1 : -1;
    state.serveTimer += dt;

    if (state.servePhase === 0) {
        // Ball toss - ball goes up near the server
        ballPos.set(
            server.pos.x + 0.3,
            TABLE_HEIGHT + 0.6 + Math.sin(state.serveTimer * 2) * 0.8,
            server.pos.z + towardOpponent * 0.5
        );
        ballVel.set(0, 0, 0);
        if (state.serveTimer > 0.8) {
            state.servePhase = 1;
            state.serveTimer = 0;
        }
    } else if (state.servePhase === 1) {
        var targetX = (Math.random() - 0.5) * TABLE_WIDTH * 0.3;
        var speed = SERVE_SPEED * server.power;
        // Start ball above server's half of the table (further back for clean bounce)
        var serveStartZ = towardOpponent * (-TABLE_LENGTH / 2 + 0.5);
        ballPos.set(server.pos.x + 0.2, TABLE_HEIGHT + 1.3, serveStartZ);
        // Serve DOWNWARD to bounce on server's side first, then carry over net
        ballVel.set((targetX - ballPos.x) * 0.25, -1.0, towardOpponent * speed * 0.5);
        ballSpin.set(
            (Math.random() - 0.5) * 2 * server.spinAbility,
            (Math.random() - 0.5) * 1,
            towardOpponent * 1 * server.spinAbility
        );
        state.servePhase = 2;
        state.ballInPlay = true;
        state.lastHitBy = state.serving;
        state.bounceCount = 0;
        state.lastBounceOnSide = null;
        server.swinging = true;
        server.swingTime = 0;
        spawnHitParticles(ballPos, server.color, 8);
        playServeSound();
        showAnnouncement('SERVE!');
    }
    ball.position.copy(ballPos);
}

// ===== PHYSICS =====
function updateBallPhysics(dt) {
    if (!state.ballInPlay) return;

    ballVel.y += GRAVITY * dt;
    ballVel.multiplyScalar(AIR_RESISTANCE);

    var magnus = new THREE.Vector3().crossVectors(ballSpin, ballVel).multiplyScalar(SPIN_FACTOR * dt);
    ballVel.add(magnus);
    ballSpin.multiplyScalar(0.998);

    var speed = ballVel.length();
    if (speed > MAX_BALL_SPEED) ballVel.multiplyScalar(MAX_BALL_SPEED / speed);

    ballPos.add(ballVel.clone().multiplyScalar(dt));

    // Table bounce
    var tableTop = TABLE_HEIGHT + TABLE_THICKNESS / 2 + BALL_RADIUS;
    var onTableX = Math.abs(ballPos.x) <= TABLE_WIDTH / 2 + 0.05;
    var onTableZ = Math.abs(ballPos.z) <= TABLE_LENGTH / 2 + 0.05;
    var onTable = onTableX && onTableZ;
    var nearEdgeX = Math.abs(Math.abs(ballPos.x) - TABLE_WIDTH / 2) < 0.12;
    var nearEdgeZ = Math.abs(Math.abs(ballPos.z) - TABLE_LENGTH / 2) < 0.12;
    var isEdgeBall = (nearEdgeX || nearEdgeZ) && onTable;

    if (ballPos.y <= tableTop && ballVel.y < 0 && onTable) {
        ballPos.y = tableTop;

        // Edge ball: unpredictable bounce
        if (isEdgeBall && !state.edgeBall) {
            state.edgeBall = true;
            ballVel.y = -ballVel.y * BALL_BOUNCE_TABLE * 0.6;
            ballVel.x += (Math.random() - 0.5) * 2;
            ballVel.z += (Math.random() - 0.5) * 1;
            showAnnouncement('EDGE BALL!');
            spawnHitParticles(ballPos, 0xffff00, 8);
        } else {
            ballVel.y = -ballVel.y * BALL_BOUNCE_TABLE;
        }

        // Spin effect on bounce
        ballVel.x += ballSpin.z * 0.15;
        ballVel.z -= ballSpin.x * 0.15;

        var bounceSide = ballPos.z < 0 ? 'left' : 'right';
        var prevBounceSide = state.lastBounceOnSide;

        // Track consecutive bounces on same side
        if (bounceSide === prevBounceSide) {
            state.bouncesThisSide++;
        } else {
            state.bouncesThisSide = 1;
        }

        state.lastBounceOnSide = bounceSide;
        state.bounceCount++;
        spawnBounceParticles(ballPos);
        playTableBounce();

        // Serve bounce rules
        if (state.rallyCount === 0 && state.lastHitBy === state.serving) {
            if (!state.serveBounceOnServerSide && bounceSide === state.serving) {
                state.serveBounceOnServerSide = true;
            } else if (state.serveBounceOnServerSide && !state.serveBounceOnReceiverSide) {
                var receiver = state.serving === 'left' ? 'right' : 'left';
                if (bounceSide === receiver) {
                    state.serveBounceOnReceiverSide = true;
                } else if (bounceSide === state.serving) {
                    awardPoint(receiver, 'Serve fault!');
                }
            }
        }

        // Double bounce rule (during rally)
        if (state.rallyCount > 0 && state.bouncesThisSide >= 2) {
            var otherSide = bounceSide === 'left' ? 'right' : 'left';
            awardPoint(otherSide, 'Double bounce!');
        }
    }

    // Net collision with LET serve detection
    if (Math.abs(ballPos.z) < NET_THICKNESS + BALL_RADIUS &&
        ballPos.y < TABLE_HEIGHT + NET_HEIGHT + TABLE_THICKNESS / 2 + BALL_RADIUS &&
        ballPos.y > TABLE_HEIGHT &&
        Math.abs(ballPos.x) < TABLE_WIDTH / 2 + 0.3) {
        if (Math.abs(ballVel.z) > 0.5) {
            if (ballPos.y > TABLE_HEIGHT + NET_HEIGHT * 0.7 + TABLE_THICKNESS / 2) {
                // Clips top of net
                ballVel.y += 0.5;
                ballVel.z *= 0.7;
                spawnHitParticles(ballPos, 0xffffff, 4);
                playNetHit();
                // LET serve
                if (state.rallyCount === 0 && state.lastHitBy === state.serving) {
                    showAnnouncement('LET! Replay');
                    state.pointPause = 1.5;
                    state.ballInPlay = false;
                }
            } else {
                // Hits net solidly
                ballVel.z *= -0.3;
                ballVel.y *= 0.5;
                ballVel.x *= 0.7;
                spawnHitParticles(ballPos, 0xffffff, 6);
                playNetHit();
                awardPoint(state.lastHitBy === 'left' ? 'right' : 'left', 'Net!');
            }
        }
    }

    // Out of bounds
    if (Math.abs(ballPos.z) > TABLE_LENGTH / 2 + 3 || Math.abs(ballPos.x) > TABLE_WIDTH / 2 + 5 || ballPos.y < -2) {
        if (state.lastHitBy && !pointAwarded) {
            var hs = state.lastHitBy;
            if (ballPos.z > TABLE_LENGTH / 2 + 2 && hs === 'left') {
                awardPoint(state.lastBounceOnSide === 'right' ? 'left' : 'right', state.lastBounceOnSide === 'right' ? 'Winner!' : 'Long!');
            } else if (ballPos.z < -TABLE_LENGTH / 2 - 2 && hs === 'right') {
                awardPoint(state.lastBounceOnSide === 'left' ? 'right' : 'left', state.lastBounceOnSide === 'left' ? 'Winner!' : 'Long!');
            } else if (Math.abs(ballPos.x) > TABLE_WIDTH / 2 + 3) {
                awardPoint(hs === 'left' ? 'right' : 'left', 'Wide!');
            } else {
                awardPoint(hs === 'left' ? 'right' : 'left', 'Out!');
            }
        }
    }

    // Floor bounce
    if (ballPos.y <= BALL_RADIUS && ballVel.y < 0) {
        ballPos.y = BALL_RADIUS;
        if (state.ballInPlay && !pointAwarded) {
            if (state.lastHitBy) {
                var ballOnSide = ballPos.z < 0 ? 'left' : 'right';
                var hitter = state.lastHitBy;
                if (ballOnSide !== hitter && state.lastBounceOnSide === ballOnSide) {
                    awardPoint(hitter, 'Ace!');
                } else if (ballOnSide !== hitter) {
                    awardPoint(hitter === 'left' ? 'right' : 'left', 'Missed table!');
                } else {
                    awardPoint(hitter === 'left' ? 'right' : 'left', 'Missed!');
                }
            }
        }
        ballVel.y = -ballVel.y * 0.5;
        ballVel.multiplyScalar(0.7);
    }

    ball.position.copy(ballPos);
    ball.rotation.x += ballSpin.x * dt;
    ball.rotation.y += ballSpin.y * dt;
    ball.rotation.z += ballSpin.z * dt;

    var bs = ballVel.length();
    if (ballGlow) {
        ballGlow.material.opacity = Math.min(0.25, bs * 0.015);
        ballGlow.scale.setScalar(1 + bs * 0.05);
    }
}



// ===== ROBOT ANIMATION =====
function updateRobotAnimation(side, dt) {
    var robot = robots[side];
    if (!robot.mesh) return;

    robot.mesh.position.x = robot.pos.x;
    robot.mesh.position.z = robot.pos.z;

    var leanX = (robot.paddlePos.x - robot.pos.x) * 0.15;
    robot.mesh.rotation.x = (side === 'left' ? -1 : 1) * 0.05;
    robot.mesh.rotation.z = -leanX;

    // Celebration spin when winning a point
    if (robot.celebrating) {
        robot.celebrateTime += dt * 6;
        robot.mesh.rotation.y = robot.bodyAngle + robot.celebrateTime * Math.PI * 2;
        if (robot.celebrateTime >= 1.0) {
            robot.celebrating = false;
            robot.celebrateTime = 0;
            robot.mesh.rotation.y = robot.bodyAngle;
        }
    } else {
        // During play: face opponent with subtle lateral tracking only
        var baseAngle = robot.bodyAngle;
        var lookOffset = Math.atan2(ballPos.x - robot.pos.x, 3) * 0.3;
        var clampedOffset = Math.max(-0.4, Math.min(0.4, lookOffset));
        var targetY = baseAngle + clampedOffset;
        robot.mesh.rotation.y += (targetY - robot.mesh.rotation.y) * 0.08;
    }

    var paddleArm = robot.mesh.getObjectByName('paddleArm');
    if (paddleArm) {
        var relX = robot.paddlePos.x - robot.pos.x;
        var relY = robot.paddlePos.y - (robot.pos.y + 2.0);
        var relZ = robot.paddlePos.z - robot.pos.z;

        var angX = Math.atan2(relZ, -relY) * 0.7;
        var angZ = Math.atan2(relX, -relY) * 0.5;

        paddleArm.rotation.x += (angX - paddleArm.rotation.x) * 0.2;
        paddleArm.rotation.z += (angZ - paddleArm.rotation.z) * 0.2;

        if (robot.swinging) {
            robot.swingTime += dt * 12;
            paddleArm.rotation.x += Math.sin(robot.swingTime) * 0.8;
            if (robot.swingTime > Math.PI) {
                robot.swinging = false;
                robot.swingTime = 0;
            }
        }

        var time = clock.getElapsedTime();
        paddleArm.rotation.z += Math.sin(time * 2 + (side === 'left' ? 0 : Math.PI)) * 0.02;
    }

    var time2 = clock.getElapsedTime();
    robot.mesh.position.y = Math.sin(time2 * 3 + (side === 'left' ? 0 : 1.5)) * 0.02;
}

// ===== SCORING =====
function awardPoint(winner, reason) {
    if (pointAwarded) return;
    pointAwarded = true;
    state.ballInPlay = false;
    state.scores[winner]++;
    state.pointPause = 2.0;

    // Reset fatigue after point
    robots.left.fatigue = Math.max(0, robots.left.fatigue - 0.2);
    robots.right.fatigue = Math.max(0, robots.right.fatigue - 0.2);

    // Winner celebrates with a spin
    robots[winner].celebrating = true;
    robots[winner].celebrateTime = 0;

    playPointScored();
    crowdReact(state.rallyCount > 5 ? 0.8 : 0.5);

    // Enhanced announcement with shot type
    var winnerName = winner === 'left' ? 'ROBO-RED' : 'ROBO-BLUE';
    var shotInfo = state.lastShotType ? ' (' + state.lastShotType + ')' : '';
    showAnnouncement(reason + ' ' + winnerName + ' scores!' + shotInfo);

    // Deuce detection (10-10 or higher with equal scores)
    state.deuce = state.scores.left >= 10 && state.scores.right >= 10 &&
        state.scores.left === state.scores.right;
    if (state.deuce) {
        showAnnouncement('DEUCE!');
    }

    // Serve rotation: normally every 2 points, but every 1 at deuce
    state.serveCount++;
    var serveSwitch = (state.scores.left >= 10 && state.scores.right >= 10) ? 1 : 2;
    if (state.serveCount >= serveSwitch) {
        state.serveCount = 0;
        state.serving = state.serving === 'left' ? 'right' : 'left';
    }

    checkSetWin();
    updateUI();
}

function checkSetWin() {
    var ls = state.scores.left;
    var rs = state.scores.right;

    if ((ls >= state.maxScore || rs >= state.maxScore) && Math.abs(ls - rs) >= 2) {
        var winner = ls > rs ? 'left' : 'right';
        state.sets[winner]++;

        if (state.sets[winner] >= Math.ceil(state.matchSets / 2)) {
            playWinFanfare();
            crowdReact(1.0);
            showAnnouncement('🏆 ' + (winner === 'left' ? 'ROBO-RED' : 'ROBO-BLUE') + ' WINS THE MATCH! 🏆');
            state.pointPause = 5;
            setTimeout(function () {
                state.scores.left = 0;
                state.scores.right = 0;
                state.sets.left = 0;
                state.sets.right = 0;
                state.serveCount = 0;
                state.serving = Math.random() < 0.5 ? 'left' : 'right';
                updateUI();
                showAnnouncement('NEW MATCH!');
            }, 5000);
        } else {
            playWinFanfare();
            crowdReact(0.8);
            showAnnouncement('Set to ' + (winner === 'left' ? 'ROBO-RED' : 'ROBO-BLUE') + '!');
            state.scores.left = 0;
            state.scores.right = 0;
            state.serving = winner === 'left' ? 'right' : 'left';
            state.serveCount = 0;
        }

        updateUI();
    }
}

// ===== CAMERA =====
function updateCamera(dt) {
    var time = clock.getElapsedTime();
    var mode = state.cameraModes[state.cameraMode];
    var targetPos = new THREE.Vector3();
    var lookAt = new THREE.Vector3(0, TABLE_HEIGHT + 0.3, 0);

    switch (mode) {
        case 'side':
            targetPos.set(8, 6, 0);
            break;
        case 'top':
            targetPos.set(0, 12, 0.1);
            break;
        case 'player1':
            targetPos.set(1.5, 4, -TABLE_LENGTH / 2 - 3);
            lookAt.set(0, TABLE_HEIGHT, TABLE_LENGTH / 4);
            break;
        case 'player2':
            targetPos.set(-1.5, 4, TABLE_LENGTH / 2 + 3);
            lookAt.set(0, TABLE_HEIGHT, -TABLE_LENGTH / 4);
            break;
        case 'cinematic':
            var r = 10;
            var sp = 0.15;
            targetPos.set(Math.cos(time * sp) * r, 5 + Math.sin(time * sp * 0.5) * 2, Math.sin(time * sp) * r);
            break;
    }

    camera.position.lerp(targetPos, 0.03);
    cameraTarget.lerp(lookAt, 0.03);
    camera.lookAt(cameraTarget);
}

// ===== UI =====
function updateUI() {
    document.getElementById('score-left').textContent = state.scores.left;
    document.getElementById('score-right').textContent = state.scores.right;
    document.getElementById('sets-left').textContent = 'Sets: ' + state.sets.left;
    document.getElementById('sets-right').textContent = 'Sets: ' + state.sets.right;
}

function updateServingIndicator() {
    var el = document.getElementById('serving-indicator');
    if (state.serving === 'left') {
        el.textContent = '← 🏓 SERVING';
        el.style.color = '#ff6666';
    } else {
        el.textContent = '🏓 SERVING →';
        el.style.color = '#6688ff';
    }
}

function updateRallyCounter() {
    var el = document.getElementById('rally-text');
    el.textContent = 'Rally: ' + state.rallyCount;
    var container = document.getElementById('rally-counter');
    if (state.rallyCount >= 5) {
        container.classList.add('highlight');
        if (state.rallyCount === 5 || state.rallyCount === 10 || state.rallyCount === 15 || state.rallyCount === 20) {
            playRallyMilestone(state.rallyCount);
            crowdReact(state.rallyCount * 0.05);
        }
    } else {
        container.classList.remove('highlight');
    }
}

function showAnnouncement(text) {
    var el = document.getElementById('announcement');
    var txt = document.getElementById('announcement-text');
    txt.textContent = text;
    el.classList.remove('hidden');
    el.classList.add('visible');
    document.getElementById('game-status').textContent = text;

    setTimeout(function () {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }, 1500);
}

function updateInfoPanel() {
    var speed = ballVel.length() * 3.6;
    document.getElementById('ball-speed').textContent = 'Speed: ' + Math.round(speed) + ' km/h';
    var spinMag = ballSpin.length();
    var spinText = 'None';
    if (spinMag > 1) spinText = 'Light';
    if (spinMag > 3) spinText = 'Medium';
    if (spinMag > 5) spinText = 'Heavy';
    // Show shot type + spin
    var shotLabel = state.lastShotType ? state.lastShotType.toUpperCase() : '';
    document.getElementById('spin-info').textContent = (shotLabel ? shotLabel + ' | ' : '') + 'Spin: ' + spinText;
}

// ===== CONTROLS =====
function setupControls() {
    document.getElementById('btn-camera').addEventListener('click', function () {
        state.cameraMode = (state.cameraMode + 1) % state.cameraModes.length;
        showAnnouncement('Camera: ' + state.cameraModes[state.cameraMode].toUpperCase());
    });

    document.getElementById('btn-speed').addEventListener('click', function () {
        var speeds = [0.5, 1, 1.5, 2];
        var labels = ['0.5x', '1x', '1.5x', '2x'];
        var idx = speeds.indexOf(state.gameSpeed);
        idx = (idx + 1) % speeds.length;
        state.gameSpeed = speeds[idx];
        this.textContent = '⏱️ ' + labels[idx];
    });

    document.getElementById('btn-pause').addEventListener('click', function () {
        state.paused = !state.paused;
        this.textContent = state.paused ? '▶️' : '⏸️';
        if (state.paused) showAnnouncement('PAUSED');
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
        state.scores.left = 0;
        state.scores.right = 0;
        state.sets.left = 0;
        state.sets.right = 0;
        state.serveCount = 0;
        state.serving = Math.random() < 0.5 ? 'left' : 'right';
        updateUI();
        showAnnouncement('NEW MATCH!');
        startServe();
    });

    document.getElementById('btn-sound').addEventListener('click', function () {
        if (!audioCtx) initAudio();
        toggleSound();
    });

    // Keyboard controls
    document.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'p') {
            state.paused = !state.paused;
            document.getElementById('btn-pause').textContent = state.paused ? '▶️' : '⏸️';
        }
        if (e.key === 'c') {
            state.cameraMode = (state.cameraMode + 1) % state.cameraModes.length;
        }
    });
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== MAIN LOOP =====
function animate() {
    requestAnimationFrame(animate);

    if (state.paused) {
        renderer.render(scene, camera);
        return;
    }

    var rawDt = clock.getDelta();
    var dt = Math.min(rawDt, 0.05) * state.gameSpeed;

    // Point pause
    if (state.pointPause > 0) {
        state.pointPause -= rawDt;
        if (state.pointPause <= 0) {
            state.pointPause = 0;
            startServe();
        }
        updateRobotAnimation('left', dt);
        updateRobotAnimation('right', dt);
        updateParticles(dt);
        updateBallTrail();
        updateCamera(dt);
        updateInfoPanel();
        renderer.render(scene, camera);
        return;
    }

    // Serve sequence
    if (!state.ballInPlay && state.servePhase < 2) {
        updateServe(dt);
    }

    // Physics
    updateBallPhysics(dt);

    // AI
    updateAI(dt);

    // Animation
    updateRobotAnimation('left', dt);
    updateRobotAnimation('right', dt);

    // Effects
    updateParticles(dt);
    updateBallTrail();

    // Camera
    updateCamera(dt);

    // UI
    updateInfoPanel();

    renderer.render(scene, camera);
}

// Start
init();
