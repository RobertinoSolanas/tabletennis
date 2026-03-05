// ============================================================
// 🏓 ROBOT TABLE TENNIS - Bot Logic
// Extracted from game.js
// ============================================================

// ===== SHOT TYPE SELECTION =====
function selectShotType(robot, ballHeight, incomingSpeed) {
    var prefs = robot.preferredShots;
    var heightAboveTable = ballHeight - TABLE_HEIGHT;
    var otherSide = robot === robots.left ? 'right' : 'left';
    var opponent = robots[otherSide];

    // --- Pressure-based strategy adjustment ---
    var mySide = robot === robots.left ? 'left' : 'right';
    var scoreDiff = state.scores[mySide] - state.scores[otherSide];
    var isAhead = scoreDiff >= 3;
    var isBehind = scoreDiff <= -3;
    var isCloseGame = Math.abs(scoreDiff) <= 1 && state.scores[mySide] >= 8;

    // Smash opportunity: ball is high — more likely when ahead or in long rally
    var smashBonus = (isAhead ? 0.15 : 0) + (state.rallyCount > 6 ? 0.1 : 0);
    if (heightAboveTable > robot.smashThreshold && Math.random() < prefs.smash * 2 + smashBonus) {
        return SHOT.SMASH;
    }

    // Counter-shot intelligence
    if (state.lastShotType === SHOT.BACKSPIN) {
        // Lift heavy backspin with topspin or push back
        if (Math.random() < 0.4) return Math.random() < 0.6 ? SHOT.TOPSPIN : SHOT.LOB;
    }
    if (state.lastShotType === SHOT.LOB && heightAboveTable > 0.4) {
        // Punish high lobs with smash
        if (Math.random() < 0.6) return SHOT.SMASH;
    }
    if (state.lastShotType === SHOT.SMASH) {
        // Block smash with controlled backspin or flat
        if (Math.random() < 0.4) return Math.random() < 0.5 ? SHOT.BACKSPIN : SHOT.FLAT;
    }
    if (state.lastShotType === SHOT.DROP) {
        // Counter drop with quick flat or topspin flick
        if (Math.random() < 0.5) return Math.random() < 0.6 ? SHOT.FLAT : SHOT.TOPSPIN;
    }

    // Rally strategy — go for winner in long rallies
    if (state.rallyCount > 8 && Math.random() < 0.3) {
        return Math.random() < 0.5 ? SHOT.SMASH : SHOT.DROP;
    }

    // Close game — play safer
    if (isCloseGame && Math.random() < 0.3) {
        return Math.random() < 0.6 ? SHOT.TOPSPIN : SHOT.BACKSPIN;
    }

    // Behind — be more aggressive
    if (isBehind && Math.random() < 0.25) {
        return Math.random() < 0.5 ? SHOT.SMASH : SHOT.TOPSPIN;
    }

    // Weighted random selection from preferences
    var r = Math.random();
    var cumulative = 0;
    var shots = Object.keys(prefs);
    for (var i = 0; i < shots.length; i++) {
        cumulative += prefs[shots[i]];
        if (r < cumulative) return shots[i];
    }
    return SHOT.FLAT;
}

// ===== PADDLE COLLISION =====
function checkPaddleCollision(side) {
    if (!state.ballInPlay) return;
    if (state.lastHitBy === side) return;
    var robot = robots[side];
    var dist = ballPos.distanceTo(robot.paddlePos);

    // Generous hit zone
    if (dist < PADDLE_RADIUS + BALL_RADIUS + 0.45) {
        // Fatigue increases during rally (slower buildup)
        robot.fatigue = Math.min(robot.maxFatigue, robot.fatigue + 0.02);

        // Miss chance (increases slowly with fatigue)
        var effectiveMissChance = robot.missChance + robot.fatigue * 0.03;
        if (Math.random() < effectiveMissChance) {
            // Robot misses! Ball goes past
            return;
        }

        var inSpeed = ballVel.length();
        var td = side === 'left' ? 1 : -1;
        var ballHeight = ballPos.y;

        // Select shot type based on AI
        var shotType = selectShotType(robot, ballHeight, inSpeed);
        state.lastShotType = shotType;
        state.edgeBall = false;

        // Shot quality affected by fatigue (reduced impact)
        var quality = robot.shotQuality * (1 - robot.fatigue * 0.08);
        var inaccuracy = (1 - quality) * 0.4;

        // Strategic targeting - aim away from opponent's current position
        var otherSide = side === 'left' ? 'right' : 'left';
        var opponentX = robots[otherSide].paddlePos.x;
        var targetX;

        // 60% chance to aim away from opponent, 20% aim at corners, 20% random
        var aimStrategy = Math.random();
        if (aimStrategy < 0.6) {
            // Aim to opposite side of where opponent is
            targetX = -opponentX * 0.7 + (Math.random() - 0.5) * 0.5;
        } else if (aimStrategy < 0.8) {
            // Aim at corners
            targetX = (Math.random() < 0.5 ? -1 : 1) * TABLE_WIDTH * 0.38;
        } else {
            // Random placement
            targetX = (Math.random() - 0.5) * TABLE_WIDTH * 0.5;
        }
        targetX = Math.max(-TABLE_WIDTH / 2 + 0.2, Math.min(TABLE_WIDTH / 2 - 0.2, targetX));
        targetX += (Math.random() - 0.5) * inaccuracy * TABLE_WIDTH * 0.5;

        // Calculate shot parameters based on type
        var hitSpeed, arcHeight, spinX, spinY, spinZ;

        switch (shotType) {
            case SHOT.TOPSPIN:
                hitSpeed = Math.max(inSpeed * BALL_BOUNCE_PADDLE * robot.power * 1.1, 5);
                hitSpeed = Math.min(hitSpeed, 10);
                arcHeight = 4.0 + Math.random() * 1.5;
                spinX = td * 4 * robot.spinAbility;  // Forward spin
                spinY = (Math.random() - 0.5) * 1;
                spinZ = (Math.random() - 0.5) * 2 * robot.spinAbility;
                break;

            case SHOT.BACKSPIN:
                hitSpeed = Math.max(inSpeed * BALL_BOUNCE_PADDLE * robot.power * 0.8, 3);
                hitSpeed = Math.min(hitSpeed, 7);
                arcHeight = 3.5 + Math.random() * 1.5;
                spinX = -td * 3.5 * robot.spinAbility;  // Backspin
                spinY = (Math.random() - 0.5) * 0.5;
                spinZ = (Math.random() - 0.5) * 1.5 * robot.spinAbility;
                break;

            case SHOT.SMASH:
                hitSpeed = Math.max(inSpeed * BALL_BOUNCE_PADDLE * robot.power * 1.4, 7);
                hitSpeed = Math.min(hitSpeed, 13);
                arcHeight = 2.5 + Math.random() * 0.5;  // Flatter but still clears net
                spinX = td * 2 * robot.spinAbility;
                spinY = 0;
                spinZ = (Math.random() - 0.5) * 1;
                // Smashes have lower accuracy
                targetX += (Math.random() - 0.5) * 0.5;
                break;

            case SHOT.LOB:
                hitSpeed = Math.max(inSpeed * 0.5, 3);
                hitSpeed = Math.min(hitSpeed, 6);
                arcHeight = 7.0 + Math.random() * 2.5;  // Very high arc
                spinX = -td * 2 * robot.spinAbility;
                spinY = (Math.random() - 0.5) * 1;
                spinZ = (Math.random() - 0.5) * 2;
                break;

            case SHOT.DROP:
                hitSpeed = Math.max(inSpeed * 0.4, 2);
                hitSpeed = Math.min(hitSpeed, 4);
                arcHeight = 3.0 + Math.random() * 0.5;  // Just enough to clear net
                spinX = -td * 3 * robot.spinAbility;  // Heavy backspin
                spinY = 0;
                spinZ = 0;
                break;

            default: // FLAT
                hitSpeed = Math.max(inSpeed * BALL_BOUNCE_PADDLE * robot.power, 4);
                hitSpeed = Math.min(hitSpeed, 9);
                arcHeight = 4.5 + Math.random() * 1.5;
                spinX = (Math.random() - 0.5) * 2 * robot.spinAbility;
                spinY = (Math.random() - 0.5) * 1;
                spinZ = td * (Math.random() * 1 + 0.3) * robot.spinAbility;
                break;
        }

        ballVel.set(
            (targetX - ballPos.x) * 0.6,
            arcHeight,
            td * hitSpeed
        );

        ballSpin.set(spinX, spinY, spinZ);

        state.lastHitBy = side;
        state.bounceCount = 0;
        state.bouncesThisSide = 0;
        state.lastBounceOnSide = null;
        state.isServeReturn = false;
        state.rallyCount++;

        spawnHitParticles(ballPos, robot.color, shotType === SHOT.SMASH ? 15 : 10);
        playPaddleHit(shotType === SHOT.SMASH ? 1.2 : robot.power);
        robot.swinging = true;
        robot.swingTime = 0;
        updateRallyCounter();
    }
}

// ===== AI =====
function updateAI(dt) {
    updateRobotAI('left', dt);
    updateRobotAI('right', dt);
}

function updateRobotAI(side, dt) {
    var robot = robots[side];
    var sd = side === 'left' ? -1 : 1;
    var ballComing = (side === 'left' && ballVel.z < 0) || (side === 'right' && ballVel.z > 0);
    var ballOnMySide = (side === 'left' && ballPos.z < 1) || (side === 'right' && ballPos.z > -1);
    var shouldTrack = state.ballInPlay && (ballComing || ballOnMySide);

    var idleZ = sd * (TABLE_LENGTH / 2 + 0.6);
    var idlePos = new THREE.Vector3(0, TABLE_HEIGHT + 0.7, idleZ);

    if (shouldTrack) {
        var targetPos = predictBallPosition(side);
        robot.paddleTarget.copy(targetPos);
        robot.paddleTarget.y = Math.max(TABLE_HEIGHT + 0.05, targetPos.y);

        // Keep paddle Z within reach zone
        var minAbsZ = robot.style === 'aggressive' ? TABLE_LENGTH / 2 - 1.5 : TABLE_LENGTH / 2 - 0.3;
        if (Math.abs(robot.paddleTarget.z) < minAbsZ) {
            robot.paddleTarget.z = sd * minAbsZ;
        }
    } else if (!state.ballInPlay) {
        robot.paddleTarget.copy(idlePos);
    } else {
        // Return toward center when ball is heading away (better recovery)
        var centerPos = new THREE.Vector3(0, TABLE_HEIGHT + 0.7, idleZ);
        robot.paddleTarget.lerp(centerPos, 0.08);
    }

    robot.paddleTarget.x = Math.max(-TABLE_WIDTH / 2 - 1.5, Math.min(TABLE_WIDTH / 2 + 1.5, robot.paddleTarget.x));
    robot.paddleTarget.y = Math.max(TABLE_HEIGHT - 0.2, Math.min(TABLE_HEIGHT + 2.8, robot.paddleTarget.y));

    var moveSpeed = robot.reactionSpeed * (shouldTrack ? 5.0 : 1.5);
    var prevPos = robot.paddlePos.clone();
    robot.paddlePos.lerp(robot.paddleTarget, moveSpeed);
    robot.paddleVel.subVectors(robot.paddlePos, prevPos).divideScalar(Math.max(dt, 0.001));

    var bodyTargetX = robot.paddlePos.x * 0.85;
    robot.pos.x += (bodyTargetX - robot.pos.x) * 0.15;
    var bodyTargetZ = sd * (TABLE_LENGTH / 2 + 0.7 + (shouldTrack ? -0.5 : 0.2));
    robot.pos.z += (bodyTargetZ - robot.pos.z) * 0.12;

    checkPaddleCollision(side);
}

function predictBallPosition(side) {
    var robot = robots[side];
    var sd = side === 'left' ? -1 : 1;
    var interceptZ = sd * (TABLE_LENGTH / 2 + 0.1);

    if (!state.ballInPlay) return new THREE.Vector3(0, TABLE_HEIGHT + 0.7, interceptZ);

    var tPos = ballPos.clone();
    var tVel = ballVel.clone();
    var tSpin = ballSpin.clone();
    var predicted = tPos.clone();
    var simDt = 0.012;  // Finer simulation timestep for better accuracy

    for (var i = 0; i < 180; i++) {  // More simulation ticks for better prediction
        tVel.y += GRAVITY * simDt;
        tVel.multiplyScalar(AIR_RESISTANCE);

        // Include Magnus effect (spin) in prediction
        var magnus = new THREE.Vector3().crossVectors(tSpin, tVel).multiplyScalar(SPIN_FACTOR * simDt);
        tVel.add(magnus);
        tSpin.multiplyScalar(0.998);

        tPos.add(tVel.clone().multiplyScalar(simDt));

        // Table bounce prediction with spin effects
        if (tPos.y < TABLE_HEIGHT + TABLE_THICKNESS / 2 + BALL_RADIUS && tVel.y < 0 &&
            Math.abs(tPos.x) < TABLE_WIDTH / 2 && Math.abs(tPos.z) < TABLE_LENGTH / 2) {
            tPos.y = TABLE_HEIGHT + TABLE_THICKNESS / 2 + BALL_RADIUS;
            tVel.y = -tVel.y * BALL_BOUNCE_TABLE;
            // Predict spin effect on bounce
            tVel.x += tSpin.z * 0.15;
            tVel.z -= tSpin.x * 0.15;
        }

        if ((side === 'left' && tPos.z <= interceptZ) || (side === 'right' && tPos.z >= interceptZ)) {
            predicted = tPos.clone();
            break;
        }
        predicted = tPos.clone();
    }

    // Very slight inaccuracy based on robot skill
    var inaccuracy = (1 - robot.accuracy) * 0.3;
    predicted.x += (Math.random() - 0.5) * inaccuracy;
    predicted.y += (Math.random() - 0.5) * inaccuracy * 0.5;
    return predicted;
}
