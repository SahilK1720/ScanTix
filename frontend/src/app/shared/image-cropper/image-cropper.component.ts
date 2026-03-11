import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

export interface CroppedEvent {
  blob: Blob;
  objectUrl: string;
}

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-cropper.component.html',
  styleUrls: ['./image-cropper.component.css']
})
export class ImageCropperComponent implements OnInit, AfterViewInit {
  @Input() imageFile!: File;
  @Input() aspectRatio: number = 16 / 9; // Default to 16:9 for event cards
  
  @Output() imageCropped = new EventEmitter<CroppedEvent>();
  @Output() cropCanceled = new EventEmitter<void>();

  @ViewChild('cropperCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private imageObj = new Image();
  
  // Transform State
  zoom = 1;
  rotation = 0;
  panX = 0;
  panY = 0;

  // Interaction State
  isDragging = false;
  startX = 0;
  startY = 0;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    if (this.imageFile) {
      const url = URL.createObjectURL(this.imageFile);
      this.imageObj.src = url;
      this.imageObj.onload = () => {
        this.resetTransforms();
        this.draw();
      };
    }
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Fit canvas to screen width for the crop modal
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    // Set internal resolution
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = 400; // Fixed visual height
    requestAnimationFrame(() => this.draw());
  }

  resetTransforms() {
    const canvas = this.canvasRef.nativeElement;
    
    // Calculate initial scale to fit image within the canvas bounds while covering the crop area
    const cropWidth = canvas.width * 0.8; // 80% of canvas width
    const cropHeight = cropWidth / this.aspectRatio;

    const scaleX = cropWidth / this.imageObj.width;
    const scaleY = cropHeight / this.imageObj.height;
    
    // Pick the larger scale to ensure the image covers the crop area completely
    this.zoom = Math.max(scaleX, scaleY);
    
    this.panX = canvas.width / 2;
    this.panY = canvas.height / 2;
    this.rotation = 0;
  }

  // --- Interaction Handlers ---

  onMouseDown(event: MouseEvent) {
    this.isDragging = true;
    this.startX = event.clientX - this.panX;
    this.startY = event.clientY - this.panY;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    this.panX = event.clientX - this.startX;
    this.panY = event.clientY - this.startY;
    requestAnimationFrame(() => this.draw());
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault(); // Stop page scrolling
    const zoomFactor = -event.deltaY * 0.001;
    let newZoom = this.zoom * Math.exp(zoomFactor);
    
    // Minimum zoom: Don't let it get smaller than the crop box
    const canvas = this.canvasRef.nativeElement;
    const cropWidth = canvas.width * 0.8;
    const cropHeight = cropWidth / this.aspectRatio;
    const minZoom = Math.max(cropWidth / this.imageObj.width, cropHeight / this.imageObj.height);
    
    this.zoom = Math.max(minZoom, Math.min(newZoom, 5)); // Cap at 5x zoom
    
    requestAnimationFrame(() => this.draw());
  }

  // --- Controls ---
  
  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.1, 5);
    this.draw();
  }

  zoomOut() {
    const canvas = this.canvasRef.nativeElement;
    const cropWidth = canvas.width * 0.8;
    const cropHeight = cropWidth / this.aspectRatio;
    const minZoom = Math.max(cropWidth / this.imageObj.width, cropHeight / this.imageObj.height);
    
    this.zoom = Math.max(this.zoom / 1.1, minZoom);
    this.draw();
  }

  rotateLeft() {
    this.rotation -= 90;
    this.draw();
  }

  rotateRight() {
    this.rotation += 90;
    this.draw();
  }

  // --- Rendering logic ---

  draw() {
    if (!this.ctx || !this.imageObj.width) return;
    const canvas = this.canvasRef.nativeElement;
    
    // Clear
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save state
    this.ctx.save();

    // Move to pan position
    this.ctx.translate(this.panX, this.panY);
    
    // Rotate
    this.ctx.rotate((this.rotation * Math.PI) / 180);
    
    // Scale
    this.ctx.scale(this.zoom, this.zoom);

    // Draw image centered at the origin
    this.ctx.drawImage(
      this.imageObj, 
      -this.imageObj.width / 2, 
      -this.imageObj.height / 2
    );

    // Restore state
    this.ctx.restore();

    // Draw crop overlay mask
    this.drawOverlay();
  }

  drawOverlay() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    // Dimensions of the crop box
    const cropWidth = canvas.width * 0.8;
    const cropHeight = cropWidth / this.aspectRatio;
    
    const cropX = (canvas.width - cropWidth) / 2;
    const cropY = (canvas.height - cropHeight) / 2;

    // Dim the outside
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, cropY); // Top
    ctx.fillRect(0, cropY, cropX, cropHeight); // Left
    ctx.fillRect(cropX + cropWidth, cropY, cropX, cropHeight); // Right
    ctx.fillRect(0, cropY + cropHeight, canvas.width, canvas.height - (cropY + cropHeight)); // Bottom

    // Draw crop border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
    
    // Optional: Draw grid lines inside crop box (third rules)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cropX + cropWidth/3, cropY);
    ctx.lineTo(cropX + cropWidth/3, cropY + cropHeight);
    ctx.moveTo(cropX + (cropWidth/3)*2, cropY);
    ctx.lineTo(cropX + (cropWidth/3)*2, cropY + cropHeight);
    
    ctx.moveTo(cropX, cropY + cropHeight/3);
    ctx.lineTo(cropX + cropWidth, cropY + cropHeight/3);
    ctx.moveTo(cropX, cropY + (cropHeight/3)*2);
    ctx.lineTo(cropX + cropWidth, cropY + (cropHeight/3)*2);
    ctx.stroke();
  }

  // --- Output ---

  async saveCrop() {
    const canvas = this.canvasRef.nativeElement;
    
    // The exact crop zone dimensions
    const cropWidth = canvas.width * 0.8;
    const cropHeight = cropWidth / this.aspectRatio;
    const cropX = (canvas.width - cropWidth) / 2;
    const cropY = (canvas.height - cropHeight) / 2;

    // Create an off-screen canvas just for the cropped area
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    const outCtx = outputCanvas.getContext('2d')!;

    // We draw the same way, but shifted by the crop box offset
    outCtx.save();
    
    // 1. Shift context so crop top-left is at 0,0
    outCtx.translate(-cropX, -cropY);
    
    // 2. Translate to pan position
    outCtx.translate(this.panX, this.panY);
    
    // 3. Rotate
    outCtx.rotate((this.rotation * Math.PI) / 180);
    
    // 4. Scale
    outCtx.scale(this.zoom, this.zoom);

    // 5. Draw
    outCtx.drawImage(
      this.imageObj, 
      -this.imageObj.width / 2, 
      -this.imageObj.height / 2
    );

    outCtx.restore();

    // Export to blob
    outputCanvas.toBlob((blob) => {
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        this.imageCropped.emit({ blob, objectUrl });
      }
    }, 'image/jpeg', 0.9);
  }

  cancel() {
    this.cropCanceled.emit();
  }
}
