const { Engine, Render, Runner, World, Bodies, Body, Events } = Matter;

const CONFIG = {
    colors: {
        background: '#2c3e50',
        path: '#1abc9c',
        preview: '#8fa3ad',
        start: '#2ecc71',
        finish: '#e74c3c',
        invalid: '#f1c40f'
    },
    ball: {
        radius: 15,
        offsetX: 20,
        offsetY: -52,
        restitution: 0.18,
        friction: 0.02,
        frictionAir: 0.003
    },
    race: {
        maxSeconds: 15
    },
    path: {
        inputMinDistance: 4,
        simplifyDistance: 8,
        resampleSpacing: 16,
        segmentThickness: 14,
        segmentOverlap: 8,
        smoothingPasses: 2,
        finishMargin: 90,
        minVerticalRange: 90,
        minProgressRatio: 0.7,
        minLengthRatio: 0.75
    },
    layout: {
        startX: 50,
        startY: 100,
        endInsetX: 80,
        endInsetY: 80
    }
};

const engine = Engine.create();
const { world } = engine;
engine.world.gravity.y = 1;

const canvas = document.getElementById('game-canvas');
const timerElement = document.getElementById('timer');
const nicknameModalElement = document.getElementById('nickname-modal');
let render = null;
const nicknameModal = bootstrap.Modal.getOrCreateInstance(nicknameModalElement, {
    backdrop: 'static',
    keyboard: false
});

let pathDrawer = null;
let startTime = null;
let timerInterval = null;
let currentTime = 0;
let pendingRecordTime = 0;
let lastCompletedPath = [];

function getCanvasSize() {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    return {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height))
    };
}

function resizeCanvasToContainer() {
    const size = getCanvasSize();
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    if (render) {
        render.options.width = size.width;
        render.options.height = size.height;
        render.canvas.width = size.width;
        render.canvas.height = size.height;
    }
}

function createPointsForCanvas() {
    return {
        startPoint: { x: CONFIG.layout.startX, y: CONFIG.layout.startY },
        endPoint: {
            x: Math.max(CONFIG.layout.startX + 160, canvas.width - CONFIG.layout.endInsetX),
            y: Math.max(CONFIG.layout.startY + 160, canvas.height - CONFIG.layout.endInsetY)
        }
    };
}

resizeCanvasToContainer();

render = Render.create({
    canvas,
    engine,
    options: {
        wireframes: false,
        background: CONFIG.colors.background,
        width: canvas.width,
        height: canvas.height
    }
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const displaySeconds = (seconds % 60).toFixed(2);
    return `${minutes.toString().padStart(2, '0')}:${displaySeconds.padStart(5, '0')}`;
}

function updateTimer() {
    if (!startTime) return;
    currentTime = (Date.now() - startTime) / 1000;
    timerElement.textContent = formatTime(currentTime);
}

function startTimer() {
    if (startTime) return;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 10);
}

function stopTimer() {
    updateTimer();
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    return currentTime;
}

function resetTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    startTime = null;
    currentTime = 0;
    timerElement.textContent = '00:00.00';
}

function isFinitePoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += distance(points[i - 1], points[i]);
    }
    return total;
}

function pathBounds(points) {
    return points.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y)
    }), {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    });
}

function simplifyPoints(points, minDistance) {
    const simplified = [];
    for (const point of points) {
        if (!isFinitePoint(point)) continue;
        if (!simplified.length || distance(simplified[simplified.length - 1], point) >= minDistance) {
            simplified.push({ x: point.x, y: point.y });
        }
    }
    return simplified;
}

function translatePathToStart(points, startPoint) {
    if (!points.length) return [];
    const dx = startPoint.x - points[0].x;
    const dy = startPoint.y - points[0].y;
    return points.map(point => ({ x: point.x + dx, y: point.y + dy }));
}

function chaikinSmooth(points, passes) {
    let current = points.map(point => ({ ...point }));
    for (let pass = 0; pass < passes; pass++) {
        if (current.length < 3) return current;
        const next = [current[0]];
        for (let i = 0; i < current.length - 1; i++) {
            const a = current[i];
            const b = current[i + 1];
            next.push({
                x: a.x * 0.75 + b.x * 0.25,
                y: a.y * 0.75 + b.y * 0.25
            });
            next.push({
                x: a.x * 0.25 + b.x * 0.75,
                y: a.y * 0.25 + b.y * 0.75
            });
        }
        next.push(current[current.length - 1]);
        current = next;
    }
    return current;
}

function resamplePath(points, spacing) {
    if (points.length < 2) return points;

    const resampled = [{ ...points[0] }];
    let carried = 0;
    let previous = points[0];

    for (let i = 1; i < points.length; i++) {
        let current = points[i];
        let segmentLength = distance(previous, current);
        if (segmentLength === 0) continue;

        while (carried + segmentLength >= spacing) {
            const needed = spacing - carried;
            const ratio = needed / segmentLength;
            const point = {
                x: previous.x + (current.x - previous.x) * ratio,
                y: previous.y + (current.y - previous.y) * ratio
            };
            resampled.push(point);
            previous = point;
            segmentLength = distance(previous, current);
            carried = 0;
        }

        carried += segmentLength;
        previous = current;
    }

    const last = points[points.length - 1];
    if (distance(resampled[resampled.length - 1], last) > spacing * 0.4) {
        resampled.push({ ...last });
    }
    return resampled;
}

function isPathInCanvas(points, margin = 120) {
    return points.every(point =>
        point.x >= -margin &&
        point.y >= -margin &&
        point.x <= canvas.width + margin &&
        point.y <= canvas.height + margin
    );
}

function validatePath(points, startPoint, endPoint) {
    if (points.length < 4) {
        return { valid: false, reason: '경로가 너무 짧습니다' };
    }

    const expectedDistance = distance(startPoint, endPoint);
    const bounds = pathBounds(points);
    const totalLength = pathLength(points);
    const horizontalProgress = bounds.maxX - startPoint.x;
    const verticalRange = bounds.maxY - bounds.minY;
    const finishReached = points.some(point =>
        point.x >= endPoint.x - CONFIG.path.finishMargin &&
        point.y >= endPoint.y - CONFIG.path.finishMargin
    );

    if (!points.every(isFinitePoint)) {
        return { valid: false, reason: '경로를 다시 그려 주세요' };
    }
    if (!isPathInCanvas(points)) {
        return { valid: false, reason: '경로가 화면 밖으로 벗어났습니다' };
    }
    if (totalLength < expectedDistance * CONFIG.path.minLengthRatio) {
        return { valid: false, reason: '경로를 더 길게 그려 주세요' };
    }
    if (horizontalProgress < (endPoint.x - startPoint.x) * CONFIG.path.minProgressRatio) {
        return { valid: false, reason: '도착점까지 더 가까이 그려 주세요' };
    }
    if (verticalRange < CONFIG.path.minVerticalRange) {
        return { valid: false, reason: '너무 평평한 경로입니다' };
    }
    if (!finishReached) {
        return { valid: false, reason: '빨간 도착 영역까지 그려 주세요' };
    }

    return { valid: true, reason: '' };
}

function processUserPath(rawPoints, startPoint, endPoint) {
    const simplified = simplifyPoints(rawPoints, CONFIG.path.simplifyDistance);
    const translated = translatePathToStart(simplified, startPoint);
    const initialValidation = validatePath(translated, startPoint, endPoint);
    if (!initialValidation.valid) return { ...initialValidation, points: translated };

    const smoothed = chaikinSmooth(translated, CONFIG.path.smoothingPasses);
    const resampled = resamplePath(smoothed, CONFIG.path.resampleSpacing);
    const finalValidation = validatePath(resampled, startPoint, endPoint);
    if (!finalValidation.valid) return { ...finalValidation, points: resampled };

    return { valid: true, reason: '', points: resampled };
}

function prepareRacePath(points) {
    if (points.length < 2) return points;
    return resamplePath(points, CONFIG.path.resampleSpacing);
}

function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}년 전`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}개월 전`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}일 전`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}시간 전`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}분 전`;
    return `${Math.max(0, Math.floor(seconds))}초 전`;
}

function readLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem('leaderboard')) || [];
    } catch {
        return [];
    }
}

function updateLeaderboard() {
    const leaderboard = readLeaderboard().sort((a, b) => a.time - b.time);
    const leaderboardElement = document.getElementById('leaderboard-list');
    leaderboardElement.innerHTML = '';

    leaderboard.forEach((record, index) => {
        const entry = document.createElement('div');
        entry.className = `leaderboard-entry${index < 10 ? ' leaderboard-entry-top' : ''}`;
        entry.style.borderLeftColor = index < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][index] : CONFIG.colors.path;

        const rank = document.createElement('div');
        rank.className = 'leaderboard-rank';
        rank.innerHTML = `<strong>#${index + 1}</strong><span>${record.time ? record.time.toFixed(2) : 'N/A'}s</span>`;

        const thumbnail = document.createElement('div');
        thumbnail.className = 'leaderboard-thumbnail';
        if (record.pathImage) {
            const image = document.createElement('img');
            image.src = record.pathImage;
            image.alt = 'Path preview';
            thumbnail.appendChild(image);
        }

        const details = document.createElement('div');
        details.className = 'leaderboard-details';

        const nickname = document.createElement('strong');
        nickname.textContent = record.nickname;

        const date = document.createElement('span');
        date.textContent = timeSince(new Date(record.timestamp));

        details.append(nickname, date);
        entry.append(rank, thumbnail, details);
        leaderboardElement.appendChild(entry);
    });
}

function capturePathSnapshot(points = lastCompletedPath) {
    try {
        const snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = 200;
        snapshotCanvas.height = 150;
        const ctx = snapshotCanvas.getContext('2d');

        ctx.fillStyle = CONFIG.colors.background;
        ctx.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);

        if (points.length > 1) {
            const bounds = pathBounds(points);
            const width = Math.max(1, bounds.maxX - bounds.minX);
            const height = Math.max(1, bounds.maxY - bounds.minY);
            const padding = 14;
            const scale = Math.min(
                (snapshotCanvas.width - padding * 2) / width,
                (snapshotCanvas.height - padding * 2) / height
            );
            const offsetX = padding - bounds.minX * scale;
            const offsetY = padding - bounds.minY * scale;

            ctx.strokeStyle = CONFIG.colors.path;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 2;
            ctx.beginPath();
            ctx.moveTo(points[0].x * scale + offsetX, points[0].y * scale + offsetY);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x * scale + offsetX, points[i].y * scale + offsetY);
            }
            ctx.stroke();
        }

        return snapshotCanvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error capturing path snapshot:', error);
        return null;
    }
}

function saveResult(nickname) {
    const leaderboard = readLeaderboard();
    leaderboard.push({
        nickname,
        time: pendingRecordTime,
        pathImage: capturePathSnapshot(),
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    pendingRecordTime = 0;
    nicknameModal.hide();
    pathDrawer.resetRun();
    updateLeaderboard();
}

function saveHandler() {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (!nickname) return;
    saveResult(nickname);
    document.getElementById('nickname-input').value = '';
}

function generateCycloidPath(startPoint, endPoint) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    if (dx <= 0 || dy <= 0) return [startPoint, endPoint];

    const endpointRatio = dy / dx;
    const ratioForTheta = theta => (1 - Math.cos(theta)) / (theta - Math.sin(theta));
    let low = 0.000001;
    let high = Math.PI * 2 - 0.000001;

    for (let i = 0; i < 80; i++) {
        const mid = (low + high) / 2;
        if (ratioForTheta(mid) > endpointRatio) {
            low = mid;
        } else {
            high = mid;
        }
    }

    const thetaMax = (low + high) / 2;
    const radius = dx / (thetaMax - Math.sin(thetaMax));
    const points = [];
    const steps = 180;

    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * thetaMax;
        points.push({
            x: startPoint.x + radius * (t - Math.sin(t)),
            y: startPoint.y + radius * (1 - Math.cos(t))
        });
    }

    points[0] = { ...startPoint };
    points[points.length - 1] = { ...endPoint };
    return points;
}

class PathDrawer {
    constructor(canvasElement, physicsWorld) {
        this.canvas = canvasElement;
        this.world = physicsWorld;
        this.rawPoints = [];
        this.currentPath = null;
        this.ball = null;
        this.state = 'idle';
        this.message = '';
        this.demoMode = false;

        const points = createPointsForCanvas();
        this.startPoint = points.startPoint;
        this.endPoint = points.endPoint;

        this.createPreviewCanvas();
        this.setupEventListeners();
        this.setupCollisionDetection();
        this.drawOverlay();
    }

    createPreviewCanvas() {
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.style.position = 'absolute';
        this.previewCanvas.style.top = '0';
        this.previewCanvas.style.left = '0';
        this.previewCanvas.style.pointerEvents = 'none';
        this.previewCanvas.style.zIndex = '10';
        this.previewCanvas.classList.add('preview-canvas');
        this.canvas.parentNode.appendChild(this.previewCanvas);
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.updatePreviewCanvasSize();
    }

    updatePreviewCanvasSize() {
        this.previewCanvas.width = this.canvas.width;
        this.previewCanvas.height = this.canvas.height;
        this.previewCanvas.style.width = this.canvas.style.width;
        this.previewCanvas.style.height = this.canvas.style.height;
    }

    updateGeometry() {
        const points = createPointsForCanvas();
        this.startPoint = points.startPoint;
        this.endPoint = points.endPoint;
        this.updatePreviewCanvasSize();
        this.drawOverlay();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', event => this.startDrawing(this.getEventCoordinates(event)));
        this.canvas.addEventListener('mousemove', event => this.continueDrawing(this.getEventCoordinates(event)));
        this.canvas.addEventListener('mouseup', () => this.finishDrawing());
        this.canvas.addEventListener('mouseleave', () => this.finishDrawing());

        this.canvas.addEventListener('touchstart', event => {
            event.preventDefault();
            if (event.touches.length === 1) this.startDrawing(this.getEventCoordinates(event));
        }, { passive: false });
        this.canvas.addEventListener('touchmove', event => {
            event.preventDefault();
            if (event.touches.length === 1) this.continueDrawing(this.getEventCoordinates(event));
        }, { passive: false });
        this.canvas.addEventListener('touchend', event => {
            event.preventDefault();
            this.finishDrawing();
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', event => {
            event.preventDefault();
            this.finishDrawing();
        }, { passive: false });
    }

    setupCollisionDetection() {
        Events.on(engine, 'afterUpdate', () => {
            if (this.state !== 'running' && this.state !== 'demo') return;
            if (!this.ball) return;
            const position = this.ball.position;
            if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
                this.resetRun('경로를 다시 그려 주세요');
                return;
            }
            if (this.isInFinishArea(position)) {
                this.finishRace();
            }
            if (currentTime >= CONFIG.race.maxSeconds) {
                this.failRace();
            }
            if (position.y > this.canvas.height + 800 || position.x > this.canvas.width + 800) {
                this.failRace();
            }
        });
    }

    getEventCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const source = event.touches?.[0] || event;
        return {
            x: source.clientX - rect.left,
            y: source.clientY - rect.top
        };
    }

    startDrawing(point) {
        if (!isFinitePoint(point)) return;
        nicknameModal.hide();
        this.clearPhysics();
        this.state = 'drawing';
        this.demoMode = false;
        this.message = '';
        this.rawPoints = [point];
        this.drawOverlay();
    }

    continueDrawing(point) {
        if (this.state !== 'drawing' || !isFinitePoint(point)) return;
        const previous = this.rawPoints[this.rawPoints.length - 1];
        if (distance(previous, point) >= CONFIG.path.inputMinDistance) {
            this.rawPoints.push(point);
            this.drawOverlay(this.rawPoints);
        }
    }

    finishDrawing() {
        if (this.state !== 'drawing') return;
        this.state = 'idle';
        if (this.rawPoints.length < 3) {
            this.resetRun('경로를 더 길게 그려 주세요');
            return;
        }

        const result = processUserPath(this.rawPoints, this.startPoint, this.endPoint);
        if (!result.valid) {
            this.rawPoints = result.points || this.rawPoints;
            this.message = result.reason;
            this.drawOverlay(this.rawPoints, CONFIG.colors.invalid);
            return;
        }

        this.startRace(result.points, false);
    }

    startRace(points, demoMode) {
        this.clearPhysics();
        this.demoMode = demoMode;
        const racePoints = prepareRacePath(points);
        this.rawPoints = racePoints.map(point => ({ ...point }));
        lastCompletedPath = [];
        if (!this.createPhysicsPath(racePoints)) {
            this.resetRun('경로를 다시 그려 주세요');
            return;
        }
        this.drawOverlay(racePoints, CONFIG.colors.path);
        this.dropBall();
        this.state = demoMode ? 'demo' : 'running';
    }

    showBestPath() {
        this.resetRun();
        const points = generateCycloidPath(this.startPoint, this.endPoint);
        this.startRace(points, true);
    }

    isInFinishArea(point) {
        return point.x >= this.endPoint.x && point.y >= this.endPoint.y;
    }

    finishRace() {
        if (this.state !== 'running' && this.state !== 'demo') return;
        const finalTime = stopTimer();
        lastCompletedPath = this.rawPoints.map(point => ({ ...point }));

        if (this.demoMode) {
            this.state = 'finished';
            this.demoMode = false;
            return;
        }

        this.state = 'finished';
        pendingRecordTime = finalTime;
        document.getElementById('modal-record-text').textContent = `기록: ${finalTime.toFixed(2)}초`;
        document.getElementById('nickname-input').value = '';
        setTimeout(() => nicknameModal.show(), 100);
    }

    failRace() {
        if (this.state !== 'running' && this.state !== 'demo') return;
        stopTimer();
        if (this.demoMode) {
            this.resetRun();
        } else {
            this.resetRun('공이 도착하지 못했습니다');
        }
    }

    dropBall() {
        if (this.ball) World.remove(this.world, this.ball);
        this.ball = Bodies.circle(
            this.startPoint.x + CONFIG.ball.offsetX,
            this.startPoint.y + CONFIG.ball.offsetY,
            CONFIG.ball.radius,
            {
                restitution: CONFIG.ball.restitution,
                friction: CONFIG.ball.friction,
                frictionAir: CONFIG.ball.frictionAir,
                render: {
                    fillStyle: CONFIG.colors.finish,
                    strokeStyle: '#c0392b',
                    lineWidth: 2
                }
            }
        );
        World.add(this.world, this.ball);
        resetTimer();
        startTimer();
    }

    createPhysicsPath(points) {
        if (points.length < 2 || !points.every(isFinitePoint)) return false;

        const bodies = [];
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const length = distance(a, b);
            if (!Number.isFinite(length) || length < 1) continue;

            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            const segment = Bodies.rectangle(
                (a.x + b.x) / 2,
                (a.y + b.y) / 2,
                length + CONFIG.path.segmentOverlap,
                CONFIG.path.segmentThickness,
                {
                    angle,
                    isStatic: true,
                    friction: 0.45,
                    render: {
                        fillStyle: CONFIG.colors.path,
                        strokeStyle: CONFIG.colors.path,
                        lineWidth: 1
                    }
                }
            );
            bodies.push(segment);
        }

        if (!bodies.length) return false;
        this.currentPath = Body.create({ parts: bodies, isStatic: true });
        const allPartsFinite = this.currentPath.parts.every(part =>
            Number.isFinite(part.position.x) &&
            Number.isFinite(part.position.y) &&
            Number.isFinite(part.angle)
        );
        if (!allPartsFinite) {
            this.currentPath = null;
            return false;
        }

        World.add(this.world, this.currentPath);
        return true;
    }

    clearPhysics() {
        if (this.currentPath) {
            World.remove(this.world, this.currentPath);
            this.currentPath = null;
        }
        if (this.ball) {
            World.remove(this.world, this.ball);
            this.ball = null;
        }
    }

    resetRun(message = '') {
        this.clearPhysics();
        this.state = 'idle';
        this.demoMode = false;
        this.rawPoints = [];
        this.message = message;
        pendingRecordTime = 0;
        resetTimer();
        this.drawOverlay();
    }

    drawOverlay(points = [], strokeStyle = CONFIG.colors.preview) {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        if (points.length > 1) this.drawPath(points, strokeStyle);
        this.drawMarkers();
        if (this.message) this.drawMessage(this.message);
    }

    drawPath(points, strokeStyle) {
        this.previewCtx.strokeStyle = strokeStyle;
        this.previewCtx.lineWidth = strokeStyle === CONFIG.colors.preview ? 4 : 6;
        this.previewCtx.lineCap = 'round';
        this.previewCtx.lineJoin = 'round';
        this.previewCtx.beginPath();
        this.previewCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.previewCtx.lineTo(points[i].x, points[i].y);
        }
        this.previewCtx.stroke();
    }

    drawMarkers() {
        this.previewCtx.fillStyle = CONFIG.colors.start;
        this.previewCtx.beginPath();
        this.previewCtx.arc(this.startPoint.x, this.startPoint.y, 8, 0, Math.PI * 2);
        this.previewCtx.fill();

        this.previewCtx.fillStyle = CONFIG.colors.finish;
        this.previewCtx.beginPath();
        this.previewCtx.arc(this.endPoint.x, this.endPoint.y, 8, 0, Math.PI * 2);
        this.previewCtx.fill();

        this.previewCtx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.previewCtx.fillRect(
            this.endPoint.x,
            this.endPoint.y,
            this.canvas.width - this.endPoint.x,
            this.canvas.height - this.endPoint.y
        );
    }

    drawMessage(message) {
        this.previewCtx.save();
        this.previewCtx.font = 'bold 22px sans-serif';
        this.previewCtx.textBaseline = 'top';
        const width = this.previewCtx.measureText(message).width + 32;
        this.previewCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        this.previewCtx.fillRect(24, 24, width, 52);
        this.previewCtx.fillStyle = CONFIG.colors.invalid;
        this.previewCtx.fillText(message, 40, 38);
        this.previewCtx.restore();
    }
}

document.getElementById('redo-button').onclick = () => {
    nicknameModal.hide();
    pathDrawer.resetRun();
};

document.getElementById('best-button').onclick = () => {
    nicknameModal.hide();
    pathDrawer.showBestPath();
};

document.getElementById('clear-button').onclick = () => {
    if (confirm('정말로 모든 기록을 지우시겠습니까?')) {
        localStorage.removeItem('leaderboard');
        updateLeaderboard();
    }
};

document.getElementById('saveButton').onclick = saveHandler;
document.getElementById('nickname-form').addEventListener('submit', event => {
    event.preventDefault();
    saveHandler();
});
nicknameModalElement.addEventListener('shown.bs.modal', () => {
    document.getElementById('nickname-input').focus();
});
nicknameModalElement.addEventListener('hide.bs.modal', () => {
    if (pathDrawer?.state === 'finished' && pendingRecordTime > 0) {
        pendingRecordTime = 0;
        pathDrawer.resetRun();
    }
});

window.addEventListener('load', () => {
    updateLeaderboard();
    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);
    pathDrawer = new PathDrawer(canvas, world);
    window.pathDrawer = pathDrawer;
    window.addEventListener('resize', handleResize);
});

function handleResize() {
    resizeCanvasToContainer();
    if (pathDrawer) {
        nicknameModal.hide();
        pathDrawer.resetRun();
        pathDrawer.updateGeometry();
    }
}
