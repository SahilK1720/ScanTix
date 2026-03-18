import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StaffService, ScanResponse } from '../../../core/services/staff.service';
import { EventService, ScanEvent } from '../../../core/services/event.service';

@Component({
    selector: 'app-staff-scanner',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header">
        <div style="display: flex; align-items: center; gap: 16px">
          <button class="btn btn-secondary btn-icon" routerLink="/staff">⬅️</button>
          <div>
            <h1>📷 <span class="gradient-text">Ticket Scanner</span></h1>
            <p>Validating for: <strong>{{ event?.title || 'Loading...' }}</strong></p>
          </div>
        </div>
      </div>

      <div class="scanner-container">
        <!-- Simulation Mode UI -->
        <div class="glass-card scanner-box">
          <div class="scanner-viewport">
            @if (validating) {
              <div class="scanner-overlay validating">
                <span class="spinner large"></span>
                <p>Verifying Ticket...</p>
              </div>
            } @else if (result) {
              <div class="scanner-overlay" [class.valid]="result.status === 'VALID_TICKET'" [class.invalid]="result.status !== 'VALID_TICKET'">
                <div class="result-icon">
                  {{ result.status === 'VALID_TICKET' ? '✅' : '❌' }}
                </div>
                <h3>{{ result.status === 'VALID_TICKET' ? 'Access Granted' : 'Access Denied' }}</h3>
                <p>{{ result.message }}</p>
                <button class="btn btn-primary" (click)="reset()">Scan Next</button>
              </div>
            } @else {
              <div class="scanner-placeholder">
                <span class="camera-icon">🎥</span>
                <p>Camera Simulation Mode</p>
                <div class="scan-line"></div>
              </div>
            }
          </div>

          <div class="scanner-controls">
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 16px">
              Simulate a scan by pasting the QR code data string below:
            </p>
            <div class="form-group">
              <textarea class="form-control" [(ngModel)]="qrInput" 
                        placeholder="Paste SCANTIX:... QR data here" 
                        rows="3" [disabled]="validating || !!result"></textarea>
            </div>
            <button class="btn btn-primary btn-block" (click)="validate()" 
                    [disabled]="validating || !!result || !qrInput.trim()">
              🔍 Simulate Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .scanner-container {
      max-width: 600px;
      margin: 0 auto;
    }
    .scanner-box {
      padding: 0;
      overflow: hidden;
    }
    .scanner-viewport {
      position: relative;
      aspect-ratio: 4/3;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .scanner-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #333;
    }
    .camera-icon { font-size: 4rem; margin-bottom: 16px; opacity: 0.3; }
    .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: var(--primary);
      box-shadow: 0 0 15px var(--primary);
      animation: scan 3s linear infinite;
    }
    @keyframes scan {
      0% { top: 0; }
      50% { top: 100%; }
      100% { top: 0; }
    }
    .scanner-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(5px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
      z-index: 10;
    }
    .scanner-overlay.valid { border: 4px solid var(--success); }
    .scanner-overlay.invalid { border: 4px solid var(--danger); }
    .result-icon { font-size: 5rem; margin-bottom: 20px; }
    .scanner-controls { padding: 32px; }
    .spinner.large { width: 60px; height: 60px; border-width: 4px; border-color: var(--primary) transparent; }
  `]
})
export class StaffScannerComponent implements OnInit {
    eventId: string = '';
    event?: ScanEvent;
    qrInput: string = '';
    validating = false;
    result: ScanResponse | null = null;

    constructor(
        private route: ActivatedRoute,
        private staffService: StaffService,
        private eventService: EventService
    ) { }

    ngOnInit() {
        this.eventId = this.route.snapshot.params['eventId'];
        this.eventService.getEvent(this.eventId).subscribe(event => this.event = event);
    }

    validate() {
        if (!this.qrInput.trim()) return;

        this.validating = true;
        // This component is legacy — real scanning now happens via /scan/:accessToken
        // For now just show invalid since we don't have an eventId-based scan endpoint here
        setTimeout(() => {
            this.result = {
                status: 'INVALID_TICKET',
                message: 'Please use your personal scanner link sent via email.'
            };
            this.validating = false;
        }, 500);
    }

    reset() {
        this.result = null;
        this.qrInput = '';
    }
}
