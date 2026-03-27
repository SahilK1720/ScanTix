import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tilted-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="tilted-card-figure" 
            [style.height]="containerHeight" 
            [style.width]="containerWidth"
            (mouseenter)="onMouseEnter()"
            (mouseleave)="onMouseLeave()"
            (mousemove)="onMouseMove($event)">
      
      @if (showMobileWarning) {
        <div class="tilted-card-mobile-alert">This effect is not optimized for mobile. Check on desktop.</div>
      }

      <div class="tilted-card-inner" #inner [style.width]="imageWidth" [style.height]="imageHeight">
        @if (imageSrc) {
          <img [src]="imageSrc" [alt]="altText" class="tilted-card-img" 
               [style.width]="imageWidth" [style.height]="imageHeight">
        }
        
        @if (displayOverlayContent && overlayContent) {
          <div class="tilted-card-overlay">
            <div class="overlay-text">{{ overlayContent }}</div>
          </div>
        }

        <ng-content></ng-content>
      </div>

      @if (showTooltip) {
        <figcaption class="tilted-card-caption" #caption>
          {{ captionText }}
        </figcaption>
      }
    </figure>
  `,
  styles: [`
    .tilted-card-figure {
      position: relative;
      width: 100%;
      height: 100%;
      perspective: 800px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0;
    }

    .tilted-card-mobile-alert {
      position: absolute;
      top: 1rem;
      text-align: center;
      font-size: 0.875rem;
      display: none;
      color: #94a3b8;
    }

    @media (max-width: 640px) {
      .tilted-card-mobile-alert { display: block; }
      .tilted-card-caption { display: none; }
    }

    .tilted-card-inner {
      position: relative;
      transform-style: preserve-3d;
      will-change: transform;
    }

    .tilted-card-img {
      position: absolute;
      top: 0;
      left: 0;
      object-fit: cover;
      will-change: transform;
      transform: translateZ(0);
    }

    .tilted-card-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      will-change: transform;
      transform: translateZ(30px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    
    .overlay-text {
      color: #fff;
      font-size: 1.5rem;
      font-weight: 800;
      text-align: center;
      padding: 0 16px;
      text-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .tilted-card-caption {
      pointer-events: none;
      position: absolute;
      left: 0;
      top: 0;
      border-radius: 6px;
      background-color: rgba(255,255,255,0.95);
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #1a1a1a;
      opacity: 0;
      z-index: 3;
      will-change: transform, opacity;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      white-space: nowrap;
    }
  `]
})
export class TiltedCardComponent implements AfterViewInit, OnDestroy {
  @Input() imageSrc: string = '';
  @Input() altText: string = 'Tilted card image';
  @Input() captionText: string = '';
  @Input() containerHeight: string = '300px';
  @Input() containerWidth: string = '100%';
  @Input() imageHeight: string = '100%';
  @Input() imageWidth: string = '100%';
  @Input() scaleOnHover: number = 1.05;
  @Input() rotateAmplitude: number = 12;
  @Input() showMobileWarning: boolean = true;
  @Input() showTooltip: boolean = true;
  @Input() displayOverlayContent: boolean = false;
  @Input() overlayContent: string = '';

  @ViewChild('inner') innerElement!: ElementRef<HTMLDivElement>;
  @ViewChild('caption') captionElement?: ElementRef<HTMLElement>;

  private animationFrameId: number = 0;
  private isHovering: boolean = false;
  private lastY: number = 0;

  // Target values
  private tX = 0;
  private tY = 0;
  private tRotateX = 0;
  private tRotateY = 0;
  private tScale = 1;
  private tOpacity = 0;
  private tRotateFig = 0;

  // Current values
  private cX = 0;
  private cY = 0;
  private cRotateX = 0;
  private cRotateY = 0;
  private cScale = 1;
  private cOpacity = 0;
  private cRotateFig = 0;

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    this.animationLoop();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationFrameId);
  }

  onMouseEnter() {
    this.isHovering = true;
    this.tScale = this.scaleOnHover;
    this.tOpacity = 1;
  }

  onMouseLeave() {
    this.isHovering = false;
    this.tScale = 1;
    this.tOpacity = 0;
    this.tRotateX = 0;
    this.tRotateY = 0;
    this.tRotateFig = 0;
  }

  onMouseMove(e: MouseEvent) {
    if (!this.el.nativeElement) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    
    // Calculate rotation limits based on amplitude
    this.tRotateX = (offsetY / (rect.height / 2)) * -this.rotateAmplitude;
    this.tRotateY = (offsetX / (rect.width / 2)) * this.rotateAmplitude;
    
    // Tooltip tracking
    this.tX = e.clientX - rect.left;
    this.tY = e.clientY - rect.top;
    
    const velocityY = offsetY - this.lastY;
    this.tRotateFig = -velocityY * 0.4;
    this.lastY = offsetY;
  }

  private lerp(start: number, end: number, factor: number) {
    return start + (end - start) * factor;
  }

  private animationLoop = () => {
    // Spring physics configuration
    const transformLerp = 0.12; 
    const tooltipLerp = 0.35;
    const opacityLerp = 0.15;
    
    this.cRotateX = this.lerp(this.cRotateX, this.tRotateX, transformLerp);
    this.cRotateY = this.lerp(this.cRotateY, this.tRotateY, transformLerp);
    this.cScale = this.lerp(this.cScale, this.tScale, transformLerp);
    this.cOpacity = this.lerp(this.cOpacity, this.tOpacity, opacityLerp);
    this.cRotateFig = this.lerp(this.cRotateFig, this.tRotateFig, transformLerp);
    this.cX = this.lerp(this.cX, this.tX, tooltipLerp);
    this.cY = this.lerp(this.cY, this.tY, tooltipLerp);

    // Apply smooth transforms to the DOM
    if (this.innerElement?.nativeElement) {
      this.innerElement.nativeElement.style.transform = `rotateX(${this.cRotateX}deg) rotateY(${this.cRotateY}deg) scale(${this.cScale})`;
    }
    
    if (this.captionElement?.nativeElement) {
      this.captionElement.nativeElement.style.transform = `translate(${this.cX + 15}px, ${this.cY + 15}px) rotate(${this.cRotateFig}deg)`;
      this.captionElement.nativeElement.style.opacity = this.cOpacity.toString();
    }

    this.animationFrameId = requestAnimationFrame(this.animationLoop);
  };
}
