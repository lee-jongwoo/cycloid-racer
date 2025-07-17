// 필요한 모듈을 Import (Matter 사용을 위한 기본 설정)
const { Engine, Render, Runner, World, Bodies, Events } = Matter;

// 기본 설정
const engine = Engine.create();
const { world } = engine;
engine.world.gravity.y = 1; // 중력 설정

const canvas = document.getElementById('game-canvas');

// Initialize canvas size before creating render
function initializeCanvas() {
    const container = document.getElementById('canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Set canvas size to match container
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.width = containerRect.width + 'px';
    canvas.style.height = containerRect.height + 'px';
}

$('#nickname-modal').on('shown.bs.modal', function () {
    // Focus on nickname input when modal is shown
    $('#nickname-input').focus();
});

// Initialize canvas size first
initializeCanvas();

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        wireframes: false,
        background: '#2c3e50',
        width: canvas.width,
        height: canvas.height
    }
});



// Add a clear button functionality
function clearPath() {
    pathDrawer.clearPath();
}

// 시뮬레이션 종료 후 처리
function finishSimulation() {
    // 닉네임을 입력받는 모달을 표시
}

// 지우기 버튼
document.getElementById('redo-button').onclick = function () {
    clearPath();
};

document.getElementById('clear-button').onclick = function() {
  // Reset localstorage
  if (confirm('정말로 모든 기록을 지우시겠습니까?')) {
    localStorage.removeItem('leaderboard');
    updateLeaderboard(); // Update leaderboard display
  }
}

// 이론적 최적 경로 보여주기 버튼
document.getElementById('best-button').onclick = function () {
    showBestPath();
};

// Show theoretical best path (cycloid)
function showBestPath() {
    // Clear current path and reset
    clearPath();
    
    // Generate cycloid path
    const cycloidPoints = generateCycloidPath();
    
    // Create physics path from cycloid points
    window.pathDrawer.createPhysicsPath(cycloidPoints);
    
    // Set flag to prevent modal from showing
    window.pathDrawer.isDemoMode = true;
    
    // Drop ball
    window.pathDrawer.dropBall();
}

// Generate cycloid path points
function generateCycloidPath() {
    const startPoint = window.pathDrawer.startPoint;
    const endPoint = window.pathDrawer.endPoint;
    
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate proper cycloid parameters for brachistochrone curve
    const points = [];
    const numPoints = 100;
    
    // For brachistochrone, we need to solve for the proper cycloid
    // that passes through both start and end points
    const angle = Math.atan2(dy, dx);
    
    // Calculate the parameter range for the cycloid
    // The cycloid equation: x = r(t - sin(t)), y = r(1 - cos(t))
    // We need to find the proper scaling to fit our endpoints
    
    const targetRatio = Math.abs(dy / dx);
    let tMax = Math.PI;
    
    // Adjust tMax to get the right slope
    if (dy > 0) { // Going downward
        // For a downward slope, we might need more than π
        tMax = Math.PI + Math.atan(targetRatio);
    }
    
    // Calculate radius based on horizontal distance
    const radius = Math.abs(dx) / (tMax - Math.sin(tMax));
    
    for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * tMax;
        
        // Standard cycloid equations
        let x = radius * (t - Math.sin(t));
        let y = radius * (1 - Math.cos(t));
        
        // Apply rotation to match the line from start to end
        const rotatedX = x * Math.cos(angle) - y * Math.sin(angle);
        const rotatedY = x * Math.sin(angle) + y * Math.cos(angle);
        
        // Translate to start point
        points.push({
            x: startPoint.x + rotatedX,
            y: startPoint.y + rotatedY
        });
    }
    
    // Ensure the last point matches the end point exactly
    const lastPoint = points[points.length - 1];
    const scaleX = dx / (lastPoint.x - startPoint.x);
    const scaleY = dy / (lastPoint.y - startPoint.y);
    
    // Apply final scaling to ensure exact endpoint match
    return points.map(point => ({
        x: startPoint.x + (point.x - startPoint.x) * scaleX,
        y: startPoint.y + (point.y - startPoint.y) * scaleY
    }));
}

function saveHandler() {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (nickname) {
        saveResult(nickname);
        $('#nickname-input').val(''); // Clear input field
        $('#nickname-modal').modal('hide'); // Hide the modal using Bootstrap
    }
}

// Prevent form from submitting
$('#nickname-form').on('submit', function (e) {
    e.preventDefault(); // Prevent default form submission
    saveHandler();
});

// 저장 버튼 클릭 이벤트 처리
document.getElementById('saveButton').onclick = saveHandler;

// 결과 데이터 저장
function saveResult(nickname) {
    const timestamp = new Date().toISOString();
    
    // Capture path snapshot
    const pathSnapshot = capturePathSnapshot();
    
    const record = {
        nickname: nickname,
        time: currentTime, // Use the actual final time
        pathImage: pathSnapshot,
        timestamp: timestamp
    };
    
    const leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
    leaderboard.push(record);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));

    // Reset game
    clearPath();
    resetTimer();

    // 리더보드 업데이트
    updateLeaderboard();
}

// Capture path snapshot as base64 image
function capturePathSnapshot() {
    try {
        // Create a temporary canvas for the snapshot
        const snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = 200; // Thumbnail width
        snapshotCanvas.height = 150; // Thumbnail height
        const snapshotCtx = snapshotCanvas.getContext('2d');
        
        // Set background
        snapshotCtx.fillStyle = '#2c3e50';
        snapshotCtx.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);
        
        if (window.pathDrawer && window.pathDrawer.rawPoints && window.pathDrawer.rawPoints.length > 1) {
            // Scale the path to fit the thumbnail
            const scaleX = snapshotCanvas.width / canvas.width;
            const scaleY = snapshotCanvas.height / canvas.height;
            const scale = Math.min(scaleX, scaleY);
            
            snapshotCtx.save();
            snapshotCtx.scale(scale, scale);
            
            // Draw the actual raw path points with better visibility
            const points = window.pathDrawer.rawPoints;
            snapshotCtx.strokeStyle = '#1abc9c';
            snapshotCtx.lineWidth = 6 / scale; // Thicker line for better visibility
            snapshotCtx.lineCap = 'round';
            snapshotCtx.lineJoin = 'round';
            
            // Add shadow for better contrast
            snapshotCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            snapshotCtx.shadowBlur = 2 / scale;
            snapshotCtx.shadowOffsetX = 1 / scale;
            snapshotCtx.shadowOffsetY = 1 / scale;
            
            snapshotCtx.beginPath();
            snapshotCtx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                snapshotCtx.lineTo(points[i].x, points[i].y);
            }
            snapshotCtx.stroke();
            
            snapshotCtx.restore();
        }
        
        return snapshotCanvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error capturing path snapshot:', error);
        return null;
    }
}

function timeSince(date) {

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = seconds / 31536000;

  if (interval > 1) {
    return Math.floor(interval) + "년 전";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + "개월 전";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + "일 전";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + "시간 전";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + "분 전";
  }
  return Math.floor(seconds) + "초 전";
}

// 리더보드 업데이트
function updateLeaderboard() {
    const leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
    leaderboard.sort((a, b) => a.time - b.time); // 시간 오름차순 정렬
    
    // 리더보드에 표시
    const leaderboardElement = document.getElementById('leaderboard-list');
    leaderboardElement.innerHTML = ''; // 기존 리더보드 초기화
    
    leaderboard.forEach((record, index) => {
        const entry = document.createElement('div');
        entry.className = 'leaderboard-entry';
        entry.style.cssText = `
            padding: 10px;
            margin: 5px 0;
            background-color: #34495e;
            border-radius: 5px;
            border-left: 3px solid ${index < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][index] : '#1abc9c'};
        `;
        
        const timeFormatted = record.time ? record.time.toFixed(2) : 'N/A';
        const dateFormatted = timeSince(new Date(record.timestamp));
        
        entry.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex-shrink: 0;">
                    <div style="font-weight: bold; color: #ecf0f1;">#${index + 1}</div>
                    <div style="font-size: 0.9em; color: #bdc3c7;">${timeFormatted}s</div>
                </div>
                ${record.pathImage ? `
                    <img src="${record.pathImage}" 
                         style="width: 60px; height: 45px; border-radius: 3px; border: 1px solid #555;" 
                         alt="Path preview">
                ` : '<div style="width: 60px; height: 45px; background: #555; border-radius: 3px;"></div>'}
                <div style="flex-grow: 1;">
                    <div style="font-weight: bold; color: #ecf0f1;">${record.nickname}</div>
                    <div style="font-size: 0.8em; color: #95a5a6;">${dateFormatted}</div>
                </div>
            </div>
        `;
        
        leaderboardElement.appendChild(entry);
    });
}


// Timer variables
let startTime = null;
let timerInterval = null;
let currentTime = 0;

// Update timer display
function updateTimer() {
    if (startTime) {
        currentTime = (Date.now() - startTime) / 1000;
        const minutes = Math.floor(currentTime / 60);
        const seconds = (currentTime % 60).toFixed(2);
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
    }
}

// Start timer
function startTimer() {
    if (!startTime) {
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 10); // Update every 10ms for smooth display
    }
}

// Stop timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    return currentTime;
}

// Reset timer
function resetTimer() {
    stopTimer();
    startTime = null;
    currentTime = 0;
    document.getElementById('timer').textContent = '00:00.00';
}


////////
class PathDrawer {
    constructor(canvas, world, startPoint, endPoint) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.world = world;
        this.startPoint = startPoint;
        this.endPoint = endPoint;

        this.isDrawing = false;
        this.rawPoints = [];
        this.currentPath = null;
        this.ball = null;
        this.ballDropped = false;
        this.isDemoMode = false; // Flag for demo mode

        this.createPreviewCanvas();
        this.setupEventListeners();
        this.drawStartEndPoints();
        this.setupCollisionDetection();
    }

    createPreviewCanvas() {
        // Create preview canvas with same dimensions as main canvas
        this.previewCanvas = document.createElement('canvas');
        this.updatePreviewCanvasSize();
        
        this.previewCanvas.style.position = 'absolute';
        this.previewCanvas.style.top = '0';
        this.previewCanvas.style.left = '0';
        this.previewCanvas.style.pointerEvents = 'none';
        this.previewCanvas.style.zIndex = '10';
        this.previewCanvas.classList.add('preview-canvas');
        
        this.canvas.parentNode.appendChild(this.previewCanvas);
        this.previewCtx = this.previewCanvas.getContext('2d');
    }

    updatePreviewCanvasSize() {
        this.previewCanvas.width = this.canvas.width;
        this.previewCanvas.height = this.canvas.height;
        this.previewCanvas.style.width = this.canvas.style.width;
        this.previewCanvas.style.height = this.canvas.style.height;
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
    }

    // Touch event handlers
    handleTouchStart(e) {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            this.isDrawing = true;
            this.rawPoints = [];
            this.rawPoints.push({ x, y });

            // Clear previous path if exists
            if (this.currentPath) {
                Matter.World.remove(this.world, this.currentPath);
                this.currentPath = null;
            }

            // Clear preview canvas
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.drawStartEndPoints();
        }
    }

    handleTouchMove(e) {
        e.preventDefault(); // Prevent scrolling
        if (!this.isDrawing || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Add point if it's far enough from the last point (reduces noise)
        const lastPoint = this.rawPoints[this.rawPoints.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);

        if (distance > 3) {
            this.rawPoints.push({ x, y });
            this.drawPreview();
        }
    }

    handleTouchEnd(e) {
        e.preventDefault(); // Prevent scrolling
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.rawPoints.length > 2) {
            this.processAndCreatePath();
        }
    }

    // Helper method to get coordinates from either mouse or touch event
    getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            // Touch event
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        } else {
            // Mouse event
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    }

    handleMouseDown(e) {
        this.isDrawing = true;
        this.rawPoints = [];
        const coords = this.getEventCoordinates(e);
        this.rawPoints.push(coords);

        // Clear previous path if exists
        if (this.currentPath) {
            Matter.World.remove(this.world, this.currentPath);
            this.currentPath = null;
        }

        // Clear preview canvas
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawStartEndPoints();
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const coords = this.getEventCoordinates(e);

        // Add point if it's far enough from the last point (reduces noise)
        const lastPoint = this.rawPoints[this.rawPoints.length - 1];
        const distance = Math.sqrt((coords.x - lastPoint.x) ** 2 + (coords.y - lastPoint.y) ** 2);

        if (distance > 3) {
            this.rawPoints.push(coords);
            this.drawPreview();
        }
    }

    handleMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.rawPoints.length > 2) {
            this.processAndCreatePath();
        }
    }

    drawPreview() {
        // Clear preview canvas and redraw
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        if (this.rawPoints.length > 1) {
            this.previewCtx.strokeStyle = '#888'; // Light grey
            this.previewCtx.lineWidth = 3;
            this.previewCtx.lineCap = 'round';
            this.previewCtx.lineJoin = 'round';
            this.previewCtx.beginPath();
            this.previewCtx.moveTo(this.rawPoints[0].x, this.rawPoints[0].y);

            for (let i = 1; i < this.rawPoints.length; i++) {
                this.previewCtx.lineTo(this.rawPoints[i].x, this.rawPoints[i].y);
            }
            this.previewCtx.stroke();
        }

        // Always show start/end points on preview canvas
        this.drawStartEndPoints();
    }

    drawStartEndPoints() {
        // Draw start point (green)
        this.previewCtx.fillStyle = '#2ecc71';
        this.previewCtx.beginPath();
        this.previewCtx.arc(this.startPoint.x, this.startPoint.y, 8, 0, Math.PI * 2);
        this.previewCtx.fill();

        // Draw end point (red)
        this.previewCtx.fillStyle = '#e74c3c';
        this.previewCtx.beginPath();
        this.previewCtx.arc(this.endPoint.x, this.endPoint.y, 8, 0, Math.PI * 2);
        this.previewCtx.fill();

        // Draw finish area indicator
        this.previewCtx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.previewCtx.fillRect(
            this.endPoint.x,
            this.endPoint.y,
            this.canvas.width - this.endPoint.x,
            this.canvas.height - this.endPoint.y
        );
    }

    setupCollisionDetection() {
        // Listen for collision events to detect when ball reaches finish area
        Events.on(engine, 'afterUpdate', () => {
            if (this.ball && this.ballDropped) {
                const ballPosition = this.ball.position;
                
                // Check if ball is in finish area (right and bottom of end point)
                if (ballPosition.x >= this.endPoint.x && ballPosition.y >= this.endPoint.y) {
                    this.finishRace();
                }
            }
        });
    }

    finishRace() {
        if (this.ballDropped) {
            this.ballDropped = false;
            const finalTime = stopTimer();
            
            // Only show modal if not in demo mode
            if (!this.isDemoMode) {
                setTimeout(() => {
                    $('#modal-record-text').text(`기록: ${finalTime.toFixed(2)}초`);
                    $('#nickname-input').val(''); // Clear input field
                    $('#nickname-modal').modal('show');
                    finishSimulation();
                }, 100);
            } else {
                // Reset demo mode
                this.isDemoMode = false;
            }
        }
    }

    dropBall() {
        // Remove existing ball if any
        if (this.ball) {
            Matter.World.remove(this.world, this.ball);
        }

        // Create new ball with offset from start point
        const ballRadius = 15;
        const offsetX = 20; // Right offset
        const offsetY = -50; // Top offset
        
        this.ball = Matter.Bodies.circle(
            this.startPoint.x + offsetX,
            this.startPoint.y + offsetY,
            ballRadius,
            {
                restitution: 0.7,
                friction: 0.001,
                frictionAir: 0.01,
                render: {
                    fillStyle: '#e74c3c',
                    strokeStyle: '#c0392b',
                    lineWidth: 2
                }
            }
        );

        Matter.World.add(this.world, this.ball);
        this.ballDropped = true;
        
        // Start the timer
        resetTimer();
        startTimer();
    }

    processAndCreatePath() {
        // Step 1: Smooth the raw points
        const smoothedPoints = this.smoothPath(this.rawPoints);

        // Step 2: Resize to fit between start and end points
        const normalizedPoints = this.normalizePathToEndpoints(smoothedPoints);

        // Step 3: Create Matter.js bodies from the path
        this.createPhysicsPath(normalizedPoints);

        // Step 4: Draw the final path
        this.drawFinalPath(normalizedPoints);

        // Step 5: Drop the ball
        this.dropBall();
    }

    smoothPath(points) {
        if (points.length < 3) return points;

        const smoothed = [];
        smoothed.push(points[0]); // Keep first point

        // Apply simple moving average smoothing
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            const smoothedPoint = {
                x: (prev.x + curr.x + next.x) / 3,
                y: (prev.y + curr.y + next.y) / 3
            };
            smoothed.push(smoothedPoint);
        }

        smoothed.push(points[points.length - 1]); // Keep last point

        // Create bezier curve points for even smoother result
        return this.createBezierPoints(smoothed);
    }

    createBezierPoints(points) {
        if (points.length < 2) return points;

        const bezierPoints = [];
        const segments = 10; // Points per segment

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            for (let t = 0; t < segments; t++) {
                const u = t / segments;
                const point = this.catmullRomSpline(p0, p1, p2, p3, u);
                bezierPoints.push(point);
            }
        }

        return bezierPoints;
    }

    catmullRomSpline(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;

        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    }

    normalizePathToEndpoints(points) {
        if (points.length === 0) return points;

        // Find the range of the drawn path
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));

        // Calculate scaling factors
        const scaleX = (this.endPoint.x - this.startPoint.x) / (maxX - minX);
        const scaleY = (this.endPoint.y - this.startPoint.y) / (maxY - minY);

        // Use the smaller scale to maintain aspect ratio
        const scale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

        // Transform points to fit between start and end
        return points.map(point => ({
            x: this.startPoint.x + (point.x - minX) * scaleX,
            y: this.startPoint.y + (point.y - minY) * scaleY
        }));
    }

    createPhysicsPath(points) {
        if (points.length < 2) return;

        const bodies = [];
        const segmentThickness = 10;

        // Create physics bodies for each segment
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;

            const segment = Matter.Bodies.rectangle(centerX, centerY, length, segmentThickness, {
                angle: angle,
                isStatic: true,
                friction: 0.3,
                render: {
                    fillStyle: '#1abc9c',
                    strokeStyle: '#1abc9c',
                    lineWidth: 2
                }
            });

            bodies.push(segment);
        }

        // Create a composite and add to world
        this.currentPath = Matter.Body.create({
            parts: bodies,
            isStatic: true
        });

        Matter.World.add(this.world, this.currentPath);
    }

    drawFinalPath(points) {
        // Clear preview canvas after final path is created
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawStartEndPoints();
    }

    drawEndpoints() {
        // This method is no longer needed as we use drawStartEndPoints
    }

    clearPath() {
        if (this.currentPath) {
            Matter.World.remove(this.world, this.currentPath);
            this.currentPath = null;
        }
        
        if (this.ball) {
            Matter.World.remove(this.world, this.ball);
            this.ball = null;
        }
        
        this.ballDropped = false;
        this.isDemoMode = false; // Reset demo mode
        resetTimer();
        
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawStartEndPoints();
    }
}


///
// 엔진 실행 설정
window.addEventListener('load', () => {
    updateLeaderboard(); // Load leaderboard on startup
    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    const startPoint = { x: 50, y: 100 };
    const endPoint = { x: canvas.width - 80, y: canvas.height - 80 };
    window.pathDrawer = new PathDrawer(canvas, world, startPoint, endPoint);
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
});

// Global resize handler
function handleResize() {
    const container = document.getElementById('canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Update main canvas
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.width = containerRect.width + 'px';
    canvas.style.height = containerRect.height + 'px';
    
    // Update Matter.js render options
    render.options.width = canvas.width;
    render.options.height = canvas.height;
    render.canvas.width = canvas.width;
    render.canvas.height = canvas.height;
    
    // Update preview canvas if pathDrawer exists
    if (window.pathDrawer) {
        window.pathDrawer.updatePreviewCanvasSize();
        window.pathDrawer.drawStartEndPoints();
    }
}