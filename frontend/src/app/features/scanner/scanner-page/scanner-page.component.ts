import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StaffService, ScannerInfoResponse } from '../../../core/services/staff.service';

export type PageState = 'LOADING' | 'SCANNING' | 'ERROR' | 'REVOKED';
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
      <div *ngIf="pageState === 'SCANNING'" style="display:flex;flex-direction:column;height:100%">
        <div class="scanner-header">
          <div>
            <div class="event-name">{{ scannerInfo?.event_name }}</div>
            <div class="event-date">{{ scannerInfo?.event_date | date:'mediumDate' }} &bull; {{ scannerInfo?.staff_name }}</div>
          </div>
          <div class="session-counter">Today: <strong>{{ sessionCount }}</strong></div>
        </div>
        <div class="video-wrapper">
          <video #videoEl autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
          <div *ngIf="scanResult === 'CALLING_API'" class="result-overlay calling"><div class="spinner-lg"></div></div>
          <div *ngIf="scanResult === 'VALID'" class="result-overlay green">
            <div class="result-icon">✅</div>
            <div class="result-label">Valid Ticket</div>
            <div *ngIf="attendeeName" class="attendee-name">{{ attendeeName }}</div>
          </div>
          <div *ngIf="scanResult === 'ALREADY_SCANNED'" class="result-overlay yellow">
            <div class="result-icon">⚠️</div><div class="result-label">Already Scanned</div>
          </div>
          <div *ngIf="scanResult === 'INVALID'" class="result-overlay red">
            <div class="result-icon">❌</div><div class="result-label">Invalid Ticket</div>
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
    :host { display:block; position:fixed; inset:0; z-index:9999; }
    .scanner-fullscreen { position:fixed; inset:0; background:#0a0a0f; color:#fff; display:flex; flex-direction:column; font-family:system-ui,sans-serif; }
    .center-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; text-align:center; }
    .spinner-lg { width:48px; height:48px; border:4px solid rgba(255,255,255,0.1); border-top-color:#a78bfa; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .scanner-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
    .event-name { font-size:1.1rem; font-weight:700; }
    .event-date { font-size:0.82rem; color:#aaa; margin-top:2px; }
    .session-counter { font-size:0.88rem; color:#aaa; }
    .session-counter strong { color:#a78bfa; font-size:1.2rem; }
    .video-wrapper { flex:1; position:relative; margin:16px; border-radius:12px; overflow:hidden; background:#111; }
    .result-overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:12px; animation:fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    .result-overlay.green  { background:rgba(16,185,129,0.88); }
    .result-overlay.yellow { background:rgba(245,158,11,0.88); }
    .result-overlay.red    { background:rgba(239,68,68,0.88); }
    .result-overlay.calling { background:rgba(0,0,0,0.6); }
    .result-icon { font-size:4rem; margin-bottom:12px; }
    .result-label { font-size:1.4rem; font-weight:700; }
    .attendee-name { font-size:1rem; margin-top:8px; opacity:0.9; }
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

  constructor(private route: ActivatedRoute, private staffService: StaffService, private cdr: ChangeDetectorRef) {}

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
        else { this.pageState = 'ERROR'; this.errorMessage = err.status === 404 ? 'Scanner link not found.' : (msg || 'Access denied.'); }
        this.cdr.detectChanges();
      }
    });
  }

  private async startCamera() {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      this.codeReader = new BrowserMultiFormatReader();
      const video = this.videoEl?.nativeElement;
      if (!video) { this.cameraError = true; this.cdr.detectChanges(); return; }
      await this.codeReader.decodeFromVideoDevice(null, video, (result: any) => {
        if (result && !this.scanning) this.onQrDetected(result.getText());
      });
    } catch { this.cameraError = true; this.cdr.detectChanges(); }
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
      this.scanResult = 'IDLE'; this.attendeeName = null; this.scanning = false; this.cdr.detectChanges();
    }, 2500);
  }

  onManualScan(value: string) {
    const qrData = value.trim();
    if (!qrData || this.scanResult === 'CALLING_API') return;
    this.onQrDetected(qrData);
  }

  ngOnDestroy() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    try { this.codeReader?.reset?.(); } catch {}
  }
}