// ============================================================
// 🏓 ROBOT TABLE TENNIS - Human Player Logic
// Mouse/Touch input and human paddle control
// ============================================================

// Human player input state
var humanMouse = { x: 0, y: 0, clicked: false, swingSpeed: 0, lastY: 0 };

// ===== MODE SELECTION =====
function startGame(mode) {
    state.mode = mode;
    document.getElementById('main-menu').classList.add('hidden');

    // Update scoreboard for human mode
    if (mode === 'pve') {
        document.getElementById('icon-left').textContent = '\uD83C\uDFAE';
        document.getElementById('name-left').textContent = 'YOU';
    } else {
        document.getElementById('icon-left').textContent = '\uD83E\uDD16';
        document.getElementById('name-left').textContent = 'ROBO-RED';
    }

    // Init audio
    if (!audioCtx) initAudio();

    // Reset and start
    state.scores.left = 0;
    state.scores.right = 0;
    state.sets.left = 0;
    state.sets.right = 0;
    state.serveCount = 0;
    state.serving = 'right';
    updateUI();

    setTimeout(function () {
        startServe();
    }, 800);
}

// ===== MOUSE/TOUCH INPUT SETUP =====
function setupHumanInput() {
    var canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('mousemove', function (e) {
        if (state.mode !== 'pve') return;
        var rect = canvas.getBoundingClientRect();
        var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        var ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        humanMouse.x = nx * (TABLE_WIDTH / 2 + 1.0);
        humanMouse.y = Math.max(TABLE_HEIGHT + 0.1, TABLE_HEIGHT + 0.7 + ny * 1.5);
        var dy = humanMouse.lastY - e.clientY;
        humanMouse.swingSpeed = dy;
        humanMouse.lastY = e.clientY;
    });

    canvas.addEventListener('mousedown', function () {
        if (state.mode !== 'pve') return;
        humanMouse.clicked = true;
    });
    canvas.addEventListener('mouseup', function () {
        humanMouse.clicked = false;
    });

    canvas.addEventListener('touchmove', function (e) {
        if (state.mode !== 'pve') return;
        var t = e.touches[0];
        var rect = canvas.getBoundingClientRect();
        var nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
        var ny = -((t.clientY - rect.top) / rect.height) * 2 + 1;
        humanMouse.x = nx * (TABLE_WIDTH / 2 + 1.0);
        humanMouse.y = Math.max(TABLE_HEIGHT + 0.1, TABLE_HEIGHT + 0.7 + ny * 1.5);
        humanMouse.swingSpeed = humanMouse.lastY - t.clientY;
        humanMouse.lastY = t.clientY;
    }, { passive: true });
    canvas.addEventListener('touchstart', function () {
        if (state.mode !== 'pve') return;
        humanMouse.clicked = true;
    }, { passive: true });
    canvas.addEventListener('touchend', function () {
        humanMouse.clicked = false;
    });

    // Menu button listeners
    document.getElementById('btn-mode-eve').addEventListener('click', function () {
        startGame('eve');
    });
    document.getElementById('btn-mode-pve').addEventListener('click', function () {
        startGame('pve');
    });
}

// ===== HUMAN PLAYER UPDATE =====
function updateHumanPlayer(dt) {
    var player = robots.left;
    var sd = -1;

    // Map mouse position to paddle target
    player.paddleTarget.x = humanMouse.x;
    player.paddleTarget.y = humanMouse.y;

    // Paddle Z: move forward when clicking (swing), otherwise stay back
    var forwardZ = -TABLE_LENGTH / 2 + 0.3;
    var backZ = -TABLE_LENGTH / 2 - 0.6;
    player.paddleTarget.z = humanMouse.clicked ? forwardZ : backZ;

    // Clamp
    player.paddleTarget.x = Math.max(-TABLE_WIDTH / 2 - 1.5, Math.min(TABLE_WIDTH / 2 + 1.5, player.paddleTarget.x));
    player.paddleTarget.y = Math.max(TABLE_HEIGHT - 0.2, Math.min(TABLE_HEIGHT + 2.8, player.paddleTarget.y));

    // Smooth follow (responsive)
    var prevPos = player.paddlePos.clone();
    player.paddlePos.lerp(player.paddleTarget, 0.4);
    player.paddleVel.subVectors(player.paddlePos, prevPos).divideScalar(Math.max(dt, 0.001));

    // Body follows paddle
    var bodyTargetX = player.paddlePos.x * 0.85;
    player.pos.x += (bodyTargetX - player.pos.x) * 0.15;
    var bodyTargetZ = sd * (TABLE_LENGTH / 2 + 0.7 + (humanMouse.clicked ? -0.5 : 0.2));
    player.pos.z += (bodyTargetZ - player.pos.z) * 0.12;

    // Check paddle collision (uses existing bot.js checkPaddleCollision)
    checkPaddleCollision('left');
}
