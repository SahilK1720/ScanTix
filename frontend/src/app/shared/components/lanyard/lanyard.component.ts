import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, Input } from '@angular/core';

interface Point { x: number; y: number; oldX: number; oldY: number; pinned?: boolean; }
interface Stick { p0: Point; p1: Point; length: number; }

@Component({
  selector: 'app-lanyard',
  standalone: true,
  template: `
    <div style="position: fixed; top: 0; right: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;">
      <!-- The canvas allows pointer events to drag the badge -->
      <canvas #canvas [style.width.vw]="100" [style.height.vh]="100" 
              style="pointer-events: auto; cursor: grab;" 
              (mousedown)="onMouseDown($event)" 
              (mousemove)="onMouseMove($event)" 
              (mouseup)="onMouseUp()" 
              (mouseleave)="onMouseUp()"
              (touchstart)="onTouchStart($event)"
              (touchmove)="onTouchMove($event)"
              (touchend)="onMouseUp()"></canvas>
    </div>
  `
})
export class LanyardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() rightOffset = 60; // Positions the lanyard horizontally from the right
  @Input() lanyardLength = 120; // Target length for the rope

  private ctx!: CanvasRenderingContext2D;
  private points: Point[] = [];
  private sticks: Stick[] = [];
  private runFrame: number = 0;
  
  private mouseX = 0;
  private mouseY = 0;
  private isDragging = false;
  private dragIndex = -1;
  private onResizeBound = this.onResize.bind(this);

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    // Init rope points (12 points for a slightly shorter rope)
    const numPoints = 12;
    const stickLen = 14; 
    const startX = window.innerWidth - this.rightOffset; 
    
    // Stretch effect on start: initialize with horizontal offset
    const initialStretch = -100; // Pull it to the left initially

    for (let i = 0; i < numPoints; i++) {
        const x = i === 0 ? startX : startX + (initialStretch * (i / numPoints));
        const y = i * stickLen;
        this.points.push({ 
            x: x, y: y, 
            oldX: x + (i === 0 ? 0 : initialStretch * 0.1), // Give it an initial velocity "kick"
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
        const loop = () => {
            this.updatePhysics();
            this.draw();
            this.runFrame = requestAnimationFrame(loop);
        };
        loop();
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
          this.points[0].x = newW - this.rightOffset;
          // Soft reset other points to follow the pin slightly, preventing "breaking"
          for (let i = 1; i < this.points.length; i++) {
              this.points[i].x = this.points[0].x;
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
      this.mouseX = e.offsetX;
      this.mouseY = e.offsetY;
      if (this.isDragging && this.dragIndex !== -1) {
          this.points[this.dragIndex].x = this.mouseX;
          this.points[this.dragIndex].y = this.mouseY;
      } else {
          // Change cursor based on proximity to badge
          const badgeP = this.points[this.points.length - 1];
          const dist = Math.hypot(badgeP.x - this.mouseX, badgeP.y - this.mouseY);
          this.canvasRef.nativeElement.style.cursor = dist < 40 ? 'grab' : 'default';
      }
  }
  onMouseUp() {
      this.isDragging = false;
      this.dragIndex = -1;
      this.canvasRef.nativeElement.style.cursor = 'grab';
  }
  onTouchStart(e: TouchEvent) {
      // Prevents scrolling while pulling lanyard
      e.preventDefault();
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      this.startDrag(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  }
  onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      this.mouseX = e.touches[0].clientX - rect.left;
      this.mouseY = e.touches[0].clientY - rect.top;
      if (this.isDragging && this.dragIndex !== -1) {
          this.points[this.dragIndex].x = this.mouseX;
          this.points[this.dragIndex].y = this.mouseY;
      }
  }

  private startDrag(x: number, y: number) {
      // Click detection: We only allow dragging the heavy badge at the end of the lanyard
      const badgeIndex = this.points.length - 1;
      const bp = this.points[badgeIndex];
      const dist = Math.hypot(bp.x - x, bp.y - y);
      if (dist < 50) { 
          this.isDragging = true;
          this.dragIndex = badgeIndex;
          this.canvasRef.nativeElement.style.cursor = 'grabbing';
      }
  }

  // --- Verlet Physics Integration ---
  updatePhysics() {
      const gravity = 0.5;
      const friction = 0.98;
      
      // Update points based on velocity & gravity
      for (const p of this.points) {
          if (p.pinned) continue;
          if (this.isDragging && p === this.points[this.dragIndex]) continue;

          let vx = (p.x - p.oldX) * friction;
          let vy = (p.y - p.oldY) * friction;
          
          p.oldX = p.x;
          p.oldY = p.y;
          
          p.x += vx;
          p.y += vy + gravity;
      }

      // Constrain sticks (Iterative solving for rigidity)
      for (let i = 0; i < 5; i++) {
          for (const s of this.sticks) {
              const dx = s.p1.x - s.p0.x;
              const dy = s.p1.y - s.p0.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance === 0) continue; 
              
              const difference = s.length - distance;
              const fraction = difference / distance / 2;
              
              const offsetX = dx * fraction;
              const offsetY = dy * fraction;

              if (!s.p0.pinned && !(this.isDragging && s.p0 === this.points[this.dragIndex])) {
                  s.p0.x -= offsetX;
                  s.p0.y -= offsetY;
              }
              if (!s.p1.pinned && !(this.isDragging && s.p1 === this.points[this.dragIndex])) {
                  s.p1.x += offsetX;
                  s.p1.y += offsetY;
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

      // Draw Lanyard Rope
      this.ctx.beginPath();
      this.ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
          // Quadratic curves for a super smooth cord
          const xc = (this.points[i].x + this.points[i-1].x) / 2;
          const yc = (this.points[i].y + this.points[i-1].y) / 2;
          this.ctx.quadraticCurveTo(this.points[i-1].x, this.points[i-1].y, xc, yc);
      }
      this.ctx.lineTo(this.points[this.points.length-1].x, this.points[this.points.length-1].y);
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#fbfbfbff'; // PickMySeats Yellow Accordion Lanyard
      this.ctx.stroke();

      // Calculate the physical angle of the badge based on the last segment's tilt
      const lastPoint = this.points[this.points.length - 1];
      const prevPoint = this.points[this.points.length - 2];
      const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x) - Math.PI / 2;

      // Draw Badge at the end of the rope
      this.drawBadge(lastPoint.x, lastPoint.y, angle);
  }

  drawBadge(x: number, y: number, angle: number) {
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      
      // Realistic Drop Shadow
      this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowOffsetY = 10;
      
      // Main Badge Body - ENLARGED (65x95)
      this.ctx.fillStyle = '#ffffffff'; 
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
         this.ctx.roundRect(-32, 0, 64, 96, 12);
      } else {
         this.ctx.rect(-32, 0, 64, 96);
      }
      this.ctx.fill();
      
      // Reset shadow
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
      
      // Metal Clip overlay
      this.ctx.fillStyle = '#94a3b8'; 
      this.ctx.fillRect(-8, -4, 16, 10);
      
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
  }
}
