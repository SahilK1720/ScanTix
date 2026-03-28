import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, Input } from '@angular/core';

interface Point { x: number; y: number; oldX: number; oldY: number; pinned?: boolean; }
interface Stick { p0: Point; p1: Point; length: number; }

@Component({
  selector: 'app-lanyard',
  standalone: true,
  template: `
    <div style="position: fixed; top: 0; right: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;">
      <!-- Canvas is now non-interactive to allow clicking through to tickets -->
      <canvas #canvas [style.width.vw]="100" [style.height.vh]="100" 
              style="pointer-events: none;"></canvas>
      
      <div #handle 
           [style]="handleStyle"
           (mousedown)="onMouseDown($event)" 
           (touchstart)="onTouchStart($event)"></div>
    </div>
  `
})
export class LanyardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('handle') handleRef!: ElementRef<HTMLDivElement>;
  @Input() rightOffset = 60; // Positions the lanyard horizontally from the right
  @Input() lanyardLength = 120; // Target length for the rope

  get isMobile(): boolean { return window.innerWidth < 768; }

  get handleStyle(): string {
    const w = this.isMobile ? 40 : 64;
    const h = this.isMobile ? 75 : 120;
    return `position:absolute;width:${w}px;height:${h}px;cursor:grab;pointer-events:auto;transform-origin:50% 10px;transition:none;`;
  }

  private ctx!: CanvasRenderingContext2D;
  private points: Point[] = [];
  private sticks: Stick[] = [];
  private runFrame: number = 0;
  
  private mouseX = 0;
  private mouseY = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private mouseVelX = 0;
  private mouseVelY = 0;
  
  private isDragging = false;
  private dragIndex = -1;
  private onResizeBound = this.onResize.bind(this);

  // Time-corrected physics
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedStep = 1000 / 60; // 60Hz physics

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    // Init rope points (18 points for a good balance of fluidity and stability)
    const numPoints = 18;
    const stickLen = 12; // Longer sticks for a more realistic lanyard length (~216px)
    const startX = window.innerWidth - this.rightOffset;
    
    // Stretch effect on start: initialize with horizontal offset
    const initialStretch = -100; // Pull it to the left initially

    for (let i = 0; i < numPoints; i++) {
        const x = i === 0 ? startX : startX + (initialStretch * (i / numPoints));
        const y = i * stickLen;
        this.points.push({ 
            x: x, y: y, 
            oldX: x + (i === 0 ? 0 : initialStretch * 0.01), // Give it an initial velocity "kick"
            oldY: y, 
            pinned: i === 0 
        });
    }
    // Connect points
    for (let i = 0; i < numPoints - 1; i++) {
        this.sticks.push({ p0: this.points[i], p1: this.points[i+1], length: stickLen });
    }

    this.ngZone.runOutsideAngular(() => {
        window.addEventListener('resize', this.onResizeBound);
        this.lastTime = performance.now();
        
        const loop = (now: number) => {
            const deltaTime = now - this.lastTime;
            this.lastTime = now;
            
            // Cap delta time to prevent "death spiral"
            this.accumulator += Math.min(deltaTime, 100);
            
            while (this.accumulator >= this.fixedStep) {
                this.updatePhysics();
                this.accumulator -= this.fixedStep;
            }
            
            this.draw();
            this.runFrame = requestAnimationFrame(loop);
        };
        this.runFrame = requestAnimationFrame(loop);
    });
  }

  private onResize() {
      const canvas = this.canvasRef.nativeElement;
      const dpr = window.devicePixelRatio || 1;
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      
      canvas.width = newW * dpr;
      canvas.height = newH * dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before re-scaling
      this.ctx.scale(dpr, dpr);
      
      // Update pinned point to match new width
      if (this.points.length > 0) {
          const dx = (newW - this.rightOffset) - this.points[0].x;
          // Shift all points proportionally to prevent "straightening out" the physics
          for (let i = 0; i < this.points.length; i++) {
              this.points[i].x += dx;
              this.points[i].oldX += dx;
          }
      }
  }

  ngOnDestroy() {
      window.removeEventListener('resize', this.onResizeBound);
      cancelAnimationFrame(this.runFrame);
  }

  // --- Input Handlers ---
  onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      this.startDrag(e.offsetX, e.offsetY);
  }
  onMouseMove(e: MouseEvent) {
      if (this.isDragging && this.dragIndex !== -1) {
          this.mouseX = e.clientX;
          this.mouseY = e.clientY;
          this.points[this.dragIndex].x = this.mouseX;
          this.points[this.dragIndex].y = this.mouseY;
      } else {
          // Change cursor based on proximity to badge (using client coords)
          const badgeP = this.points[this.points.length - 1];
          const dist = Math.hypot(badgeP.x - e.clientX, badgeP.y - e.clientY);
          this.canvasRef.nativeElement.style.cursor = dist < 40 ? 'grab' : 'default';
      }
  }
  onMouseUp() {
      this.isDragging = false;
      document.body.classList.remove('no-select');
      this.dragIndex = -1;
      if (this.handleRef) this.handleRef.nativeElement.style.cursor = 'grab';
  }
  onTouchStart(e: TouchEvent) {
      // Prevents scrolling while pulling lanyard
      e.preventDefault();
      const t = e.touches[0];
      this.startDragAt(t.clientX, t.clientY);

      const onMove = (ev: TouchEvent) => {
        ev.preventDefault();
        if (!this.isDragging || this.dragIndex === -1) return;
        const tx = ev.touches[0].clientX;
        const ty = ev.touches[0].clientY;
        const filter = 0.3;
        this.mouseVelX = (tx - this.lastMouseX) * filter + this.mouseVelX * (1 - filter);
        this.mouseVelY = (ty - this.lastMouseY) * filter + this.mouseVelY * (1 - filter);
        this.mouseX = tx;
        this.mouseY = ty;
        this.lastMouseX = tx;
        this.lastMouseY = ty;
        this.points[this.dragIndex].x = tx;
        this.points[this.dragIndex].y = ty;
      };
      const onUp = () => {
        this.isDragging = false;
        this.dragIndex = -1;
        document.body.classList.remove('no-select');
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
  }

  private startDragAt(x: number, y: number) {
      this.isDragging = true;
      document.body.classList.add('no-select');
      this.dragIndex = this.points.length - 1;
      this.lastMouseX = x;
      this.lastMouseY = y;
      this.mouseVelX = 0;
      this.mouseVelY = 0;
      if (this.handleRef) this.handleRef.nativeElement.style.cursor = 'grabbing';
  }

  private startDrag(x: number, y: number) {
      this.startDragAt(x, y);
      
      const onMove = (e: MouseEvent) => {
          if (!this.isDragging) return;
          const filter = 0.4;
          this.mouseVelX = (e.clientX - this.lastMouseX) * filter + this.mouseVelX * (1 - filter);
          this.mouseVelY = (e.clientY - this.lastMouseY) * filter + this.mouseVelY * (1 - filter);
          
          this.mouseX = e.clientX;
          this.mouseY = e.clientY;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;

          this.points[this.dragIndex].x = this.mouseX;
          this.points[this.dragIndex].y = this.mouseY;
      };
      const onUp = () => {
          this.onMouseUp();
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
  }

  // --- Verlet Physics Integration with Sub-stepping ---
  updatePhysics() {
      const subSteps = 8; // Higher sub-stepping for stability with springs
      const gravity = 0.5 / subSteps;
      const friction = Math.pow(0.97, 1 / subSteps); // Slightly more damping
      
      for (let s = 0; s < subSteps; s++) {
          for (const p of this.points) {
              if (p.pinned) continue;
              if (this.isDragging && p === this.points[this.dragIndex]) {
                  // While dragging, just keep it at mouse pos
                  // but maintain old pos for velocity on release
                  p.oldX = p.x - this.mouseVelX / subSteps;
                  p.oldY = p.y - this.mouseVelY / subSteps;
                  continue;
              }

              const vx = (p.x - p.oldX) * friction;
              const vy = (p.y - p.oldY) * friction;
              
              p.oldX = p.x;
              p.oldY = p.y;
              
              p.x += vx;
              p.y += vy + gravity;
          }

          // Elastic "Spring" Rigidity solver
          // We allow some stretch for a "meatier" feel
          for (let i = 0; i < 10; i++) {
              for (const stick of this.sticks) {
                  const dx = stick.p1.x - stick.p0.x;
                  const dy = stick.p1.y - stick.p0.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  if (distance === 0) continue;
                  
                  // Stiffness: 0.1 means it takes 10 iterations to correct fully
                  // which creates an elastic effect.
                  const stiffness = 0.8; 
                  const difference = (stick.length - distance) / distance;
                  const fraction = difference * 0.5 * stiffness;
                  
                  const offsetX = dx * fraction;
                  const offsetY = dy * fraction;

                  if (!stick.p0.pinned && !(this.isDragging && stick.p0 === this.points[this.dragIndex])) {
                      stick.p0.x -= offsetX;
                      stick.p0.y -= offsetY;
                  }
                  if (!stick.p1.pinned && !(this.isDragging && stick.p1 === this.points[this.dragIndex])) {
                      stick.p1.x += offsetX;
                      stick.p1.y += offsetY;
                  }
              }
          }
      }
  }

  // --- Canvas Rendering ---
  draw() {
      const canvas = this.canvasRef.nativeElement;
      const w = window.innerWidth; 
      const h = window.innerHeight;
      this.ctx.clearRect(0, 0, w, h);

      // Draw Lanyard Rope (Improved Curve Rendering)
      this.ctx.beginPath();
      this.ctx.moveTo(this.points[0].x, this.points[0].y);
      
      for (let i = 1; i < this.points.length - 1; i++) {
          const cpX = this.points[i].x;
          const cpY = this.points[i].y;
          const destX = (this.points[i].x + this.points[i+1].x) / 2;
          const destY = (this.points[i].y + this.points[i+1].y) / 2;
          this.ctx.quadraticCurveTo(cpX, cpY, destX, destY);
      }
      
      // Final connection to badge
      const lastPoint = this.points[this.points.length - 1];
      this.ctx.lineTo(lastPoint.x, lastPoint.y);
      
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#fbfbfbff'; 
      this.ctx.stroke();

      // Shadow for the rope to add depth
      this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetY = 2;
      this.ctx.stroke();
      this.ctx.shadowColor = 'transparent';

      // Calculate smooth tilt (average of last 3 points for stability)
      const p1 = this.points[this.points.length - 1];
      const p2 = this.points[this.points.length - 3];
      const angle = Math.atan2(p1.y - p2.y, p1.x - p2.x) - Math.PI / 2;

      // Draw Badge at the end of the rope
      this.drawBadge(lastPoint.x, lastPoint.y, angle);
  }

  drawBadge(x: number, y: number, angle: number) {
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      
      // Scale down badge on mobile
      const scale = this.isMobile ? 0.6 : 1.0;
      this.ctx.scale(scale, scale);

      // Shift the badge UP so the hole (at y=10) aligns with the rope end (0,0)
      this.ctx.translate(0, -10);
      
      // Realistic Drop Shadow
      this.ctx.shadowColor = 'rgba(0,0,0,0.4)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 8;
      
      // Main Badge Body
      this.ctx.fillStyle = '#ffffffff'; 
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
         this.ctx.roundRect(-32, 0, 64, 96, 12);
      } else {
         this.ctx.rect(-32, 0, 64, 96);
      }
      this.ctx.fill();
      
      // Reset shadow for inner elements
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetY = 0;
      
      // Shiny Header Strip
      this.ctx.fillStyle = '#eab308';
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
         this.ctx.roundRect(-32, 0, 64, 22, [12, 12, 0, 0]);
      } else {
         this.ctx.rect(-32, 0, 64, 22);
      }
      this.ctx.fill();
      
      // Physical Hole
      this.ctx.fillStyle = '#0f172a';
      this.ctx.beginPath();
      this.ctx.arc(0, 10, 4, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Metal Clip overlay - ENHANCED
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#94a3b8';
      this.ctx.strokeRect(-8, 2, 16, 12);
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.fillRect(-8, 2, 16, 12);
      
      // Additional clip detail (the "pin")
      this.ctx.fillStyle = '#64748b';
      this.ctx.fillRect(-2, 4, 4, 8);
      
      // Typography - ENLARGED
      this.ctx.fillStyle = 'white';
      this.ctx.font = '32px Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🎟️', 0, 50);
      
      this.ctx.fillStyle = '#000000ff';
      this.ctx.font = 'bold 9px Poppins, sans-serif';
      this.ctx.fillText('PICKMYSEAT', 0, 68);
      
      this.ctx.fillStyle = '#10b981'; // Online dot
      this.ctx.beginPath();
      this.ctx.arc(0, 82, 3.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

      // Sync the invisible interactive handle with the drawn badge
      if (this.handleRef) {
          const hw = this.isMobile ? 40 : 64;
          const hh = this.isMobile ? 75 : 120;
          const h = this.handleRef.nativeElement;
          h.style.width = `${hw}px`;
          h.style.height = `${hh}px`;
          h.style.left = `${x - hw / 2}px`;
          h.style.top = `${y - 10}px`; // Align with pivot
          h.style.transform = `rotate(${angle}rad)`;
      }
  }
}
