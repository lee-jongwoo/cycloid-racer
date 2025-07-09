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
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    handleMouseDown(e) {
        this.isDrawing = true;
        this.rawPoints = [];
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.rawPoints.push({ x, y });
        
        // Clear previous path if exists
        if (this.currentPath) {
            Matter.World.remove(this.world, this.currentPath);
            this.currentPath = null;
        }
    }
    
    handleMouseMove(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Add point if it's far enough from the last point (reduces noise)
        const lastPoint = this.rawPoints[this.rawPoints.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        if (distance > 3) {
            this.rawPoints.push({ x, y });
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
        // Clear and redraw the preview
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.rawPoints.length > 1) {
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(this.rawPoints[0].x, this.rawPoints[0].y);
            
            for (let i = 1; i < this.rawPoints.length; i++) {
                this.ctx.lineTo(this.rawPoints[i].x, this.rawPoints[i].y);
            }
            this.ctx.stroke();
        }
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
                    fillStyle: '#8B4513',
                    strokeStyle: '#654321',
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (points.length > 1) {
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 10;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
        }
        
        // Draw start and end points
        this.drawEndpoints();
    }
    
    drawEndpoints() {
        // Draw start point
        this.ctx.fillStyle = '#00FF00';
        this.ctx.beginPath();
        this.ctx.arc(this.startPoint.x, this.startPoint.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw end point
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(this.endPoint.x, this.endPoint.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    clearPath() {
        if (this.currentPath) {
            Matter.World.remove(this.world, this.currentPath);
            this.currentPath = null;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawEndpoints();
    }
}
