import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StaffService, ScannerInfoResponse } from '../../../core/services/staff.service';

export type PageState = 'LOADING' | 'SCANNING' | 'ERROR' | 'REVOKED' | 'NOT_YET_AVAILABLE' | 'EXPIRED';
export type ScanResultState = 'IDLE' | 'CALLING_API' | 'VALID' | 'ALREADY_SCANNED' | 'INVALID';

@Component({
  selector: 'app-scanner-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scanner-fullscreen">
      <div *ngIf="pageState === 'LOADING'" class="center-screen">
        <div class="spinner-lg"></div>
        <p style="margin-top:16px;color:#aaa">Verifying scanner access...</p>
      </div>
      <div *ngIf="pageState === 'ERROR'" class="center-screen">
        <div style="font-size:4rem;margin-bottom:16px">🔒</div>
        <h2 style="color:#ef4444;margin-bottom:8px">Access Denied</h2>
        <p style="color:#aaa;max-width:320px;text-align:center">{{ errorMessage }}</p>
      </div>
      <div *ngIf="pageState === 'REVOKED'" class="center-screen">
        <div style="font-size:5rem;margin-bottom:16px">🚫</div>
        <h2 style="color:#ef4444;margin-bottom:8px">Access Revoked</h2>
        <p style="color:#aaa;max-width:320px;text-align:center">Your scanner access has been revoked.</p>
      </div>
      <div *ngIf="pageState === 'NOT_YET_AVAILABLE'" class="center-screen">
        <div style="font-size:5rem;margin-bottom:16px">⏳</div>
        <h2 style="color:#f59e0b;margin-bottom:8px">Not Yet Available</h2>
        <p style="color:#aaa;max-width:360px;text-align:center">{{ errorMessage }}</p>
        <p style="color:#666;margin-top:12px;font-size:0.85rem">Please come back closer to gate open time.</p>
      </div>
      <div *ngIf="pageState === 'EXPIRED'" class="center-screen">
        <div style="font-size:5rem;margin-bottom:16px">🏁</div>
        <h2 style="color:#6b7280;margin-bottom:8px">Event Ended</h2>
        <p style="color:#aaa;max-width:360px;text-align:center">{{ errorMessage }}</p>
      </div>
      <div *ngIf="pageState === 'SCANNING'" style="display:flex;flex-direction:column;flex:1">
        <div class="scanner-header">
          <div>
            <div class="event-name">{{ scannerInfo?.event_name }}</div>
            <div class="event-date">{{ scannerInfo?.event_date | date:'mediumDate' }} &bull; {{ scannerInfo?.staff_name }}</div>
          </div>
          <div class="session-counter">Scans: <strong>{{ sessionCount }}</strong></div>
        </div>
        <div class="video-container">
          <div class="video-wrapper">
            <video #videoEl autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
            
            <!-- Floating QR Guide Corner Indicators -->
            <div class="qr-guide">
              <div class="corner-indicator top-left"></div>
              <div class="corner-indicator top-right"></div>
              <div class="corner-indicator bottom-left"></div>
              <div class="corner-indicator bottom-right"></div>
            </div>

            <div *ngIf="scanResult === 'CALLING_API'" class="result-overlay calling"><div class="spinner-lg"></div></div>
            <div *ngIf="scanResult === 'VALID'" class="result-overlay green">
              <div class="result-icon">✅</div>
              <div class="result-label">Success</div>
              <div *ngIf="attendeeName" class="attendee-name">{{ attendeeName }}</div>
            </div>
            <div *ngIf="scanResult === 'ALREADY_SCANNED'" class="result-overlay yellow">
              <div class="result-icon">⚠️</div><div class="result-label">Already Used</div>
            </div>
            <div *ngIf="scanResult === 'INVALID'" class="result-overlay red">
              <div class="result-icon">❌</div><div class="result-label">Invalid</div>
            </div>
          </div>
        </div>
        <div *ngIf="cameraError" class="camera-error">
          📷 Camera unavailable — use manual input below.
        </div>
        <!-- Manual QR input fallback -->
        <div class="manual-input">
          <input #manualInput type="text" placeholder="Paste QR code data (SCANTIX:...)" class="qr-input"
            (keydown.enter)="onManualScan(manualInput.value); manualInput.value=''" />
          <button (click)="onManualScan(manualInput.value); manualInput.value=''" class="scan-btn"
            [disabled]="scanResult === 'CALLING_API'">Scan</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; min-height: calc(100vh - 64px); }
    .scanner-fullscreen { min-height: calc(100vh - 64px); background:#0a0a0f; color:#fff; display:flex; flex-direction:column; font-family:'Poppins',sans-serif; }
    .center-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; text-align:center; }
    .spinner-lg { width:48px; height:48px; border:4px solid rgba(255,255,255,0.1); border-top-color:#a78bfa; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .scanner-header { display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:rgba(0,0,0,0.4); border-bottom:1px solid rgba(255,255,255,0.1); flex-shrink:0; }
    .event-name { font-size:1.1rem; font-weight:700; }
    .event-date { font-size:0.82rem; color:#aaa; margin-top:2px; }
    .session-counter { font-size:0.88rem; color:#aaa; }
    .session-counter strong { color:#a78bfa; font-size:0.88rem; }
    .video-container { 
      flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; 
      background: #000;
    }
    .video-wrapper { 
      position: relative; width: 100%; max-width: 450px; 
      aspect-ratio: 4 / 3; overflow: hidden; border-radius: 24px;
      box-shadow: 0 0 40px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255,255,255,0.1); 
    }

    /* Corner Guide Styles */
    .qr-guide {
      position: absolute; top: 50%; left: 50%; width: 200px; height: 200px;
      transform: translate(-50%, -50%);
      pointer-events: none; z-index: 10;
    }
    .corner-indicator {
      position: absolute; width: 32px; height: 32px;
      border-color: var(--success); border-style: solid;
    }
    .top-left { top: 0; left: 0; border-width: 4px 0 0 4px; border-top-left-radius: 6px; }
    .top-right { top: 0; right: 0; border-width: 4px 4px 0 0; border-top-right-radius: 6px; }
    .bottom-left { bottom: 0; left: 0; border-width: 0 0 4px 4px; border-bottom-left-radius: 6px; }
    .bottom-right { bottom: 0; right: 0; border-width: 0 4px 4px 0; border-bottom-right-radius: 6px; }

    .result-overlay { 
      position: absolute; inset: 0; display: flex; flex-direction: column; 
      align-items: center; justify-content: center; z-index: 20; 
      backdrop-filter: blur(4px); animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }
    .result-overlay.green  { background: rgba(16, 185, 129, 0.9); }
    .result-overlay.yellow { background: rgba(245, 158, 11, 0.9); }
    .result-overlay.red    { background: rgba(239, 68, 68, 0.9); }
    .result-overlay.calling { background: rgba(0, 0, 0, 0.7); }
    .result-icon { font-size: 3.5rem; margin-bottom: 8px; }
    .result-label { font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .attendee-name { font-size: 0.95rem; margin-top: 4px; opacity: 0.95; font-weight: 500; }
    .camera-error { margin:0 16px 16px; padding:16px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; color:#fca5a5; font-size:0.9rem; text-align:center; flex-shrink:0; }
    .manual-input { display:flex; gap:8px; padding:12px 16px; background:rgba(255,255,255,0.03); border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
    .qr-input { flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:10px 14px; color:#fff; font-size:0.9rem; outline:none; }
    .qr-input::placeholder { color:#666; }
    .qr-input:focus { border-color:#a78bfa; }
    .scan-btn { background:#a78bfa; color:#fff; border:none; border-radius:8px; padding:10px 20px; font-size:0.9rem; font-weight:600; cursor:pointer; white-space:nowrap; }
    .scan-btn:disabled { opacity:0.5; cursor:not-allowed; }
  `]
})
export class ScannerPageComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  pageState: PageState = 'LOADING';
  scanResult: ScanResultState = 'IDLE';
  scannerInfo: ScannerInfoResponse | null = null;
  errorMessage = 'Invalid or expired scanner link.';
  cameraError = false;
  sessionCount = 0;
  attendeeName: string | null = null;
  private accessToken = '';
  private eventId = '';
  private scanning = false;
  private codeReader: any = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private frameLoopId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(private route: ActivatedRoute, private staffService: StaffService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.accessToken = this.route.snapshot.paramMap.get('accessToken') || '';
    if (!this.accessToken) {
      this.pageState = 'ERROR'; this.errorMessage = 'Invalid scanner link.'; this.cdr.detectChanges(); return;
    }
    this.staffService.getScannerInfo(this.accessToken).subscribe({
      next: info => {
        this.scannerInfo = info; this.eventId = info.event_id;
        this.sessionCount = Number(info.daily_scan_count) || 0;
        this.pageState = 'SCANNING'; this.cdr.detectChanges();
        setTimeout(() => this.startCamera(), 150);
      },
      error: err => {
        const msg = err.error?.message || '';
        if (err.status === 403 && msg.toLowerCase().includes('revoked')) { this.pageState = 'REVOKED'; }
        else if (err.status === 423) {
          this.pageState = 'NOT_YET_AVAILABLE';
          this.errorMessage = msg || 'Scanner will be available 30 minutes before gate open time.';
        }
        else if (err.status === 410) {
          this.pageState = 'EXPIRED';
          this.errorMessage = msg || 'This scanner has expired because the event has ended.';
        }
        else { this.pageState = 'ERROR'; this.errorMessage = err.status === 404 ? 'Scanner link not found.' : (msg || 'Access denied.'); }
        this.cdr.detectChanges();
      }
    });
  }

  private async startCamera() {
    try {
      const video = this.videoEl?.nativeElement;
      if (!video) { this.cameraError = true; this.cdr.detectChanges(); return; }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = this.stream;
      await video.play();

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      this.codeReader = new BrowserMultiFormatReader();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      this.startFrameLoop(canvas, ctx);
    } catch (err) {
      console.error('Camera error:', err);
      this.cameraError = true;
      this.cdr.detectChanges();
    }
  }

  private startFrameLoop(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    const video = this.videoEl?.nativeElement;
    const tick = () => {
      if (this.pageState !== 'SCANNING') return;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const result = this.codeReader?.decodeFromCanvas(canvas);
          if (result && !this.scanning) {
            this.frameLoopId = null; // null out so scheduleReset knows the loop is paused
            this.onQrDetected(result.getText());
            return; // pause loop during API call; scheduleReset restores it
          }
        } catch { /* no QR in frame — normal */ }
      }
      this.frameLoopId = requestAnimationFrame(tick);
    };
    this.frameLoopId = requestAnimationFrame(tick);
  }

  private stopCamera() {
    if (this.frameLoopId !== null) { cancelAnimationFrame(this.frameLoopId); this.frameLoopId = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    try { this.codeReader?.reset?.(); } catch { }
  }

  private onQrDetected(qrData: string) {
    if (this.scanning || this.pageState !== 'SCANNING') return;
    this.scanning = true; this.scanResult = 'CALLING_API'; this.cdr.detectChanges();
    this.staffService.scanTicket(this.eventId, this.accessToken, qrData).subscribe({
      next: res => {
        this.attendeeName = res.attendee_name || null;
        if (res.status === 'VALID_TICKET') { this.scanResult = 'VALID'; this.sessionCount++; }
        else if (res.status === 'TICKET_ALREADY_SCANNED') this.scanResult = 'ALREADY_SCANNED';
        else this.scanResult = 'INVALID';
        this.cdr.detectChanges(); this.scheduleReset();
      },
      error: err => {
        if (err.status === 403) { this.pageState = 'REVOKED'; this.scanning = false; }
        else { this.scanResult = 'INVALID'; this.scheduleReset(); }
        this.cdr.detectChanges();
      }
    });
  }

  private scheduleReset() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.scanResult = 'IDLE'; this.attendeeName = null; this.scanning = false;
      // Resume frame loop — frameLoopId is null only when loop was paused by onQrDetected
      if (this.frameLoopId === null && this.stream && this.pageState === 'SCANNING') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        this.startFrameLoop(canvas, ctx);
      }
      this.cdr.detectChanges();
    }, 2500);
  }

  onManualScan(value: string) {
    const qrData = value.trim();
    if (!qrData || this.scanResult === 'CALLING_API') return;
    this.onQrDetected(qrData);
  }

  ngOnDestroy() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.stopCamera();
  }
}