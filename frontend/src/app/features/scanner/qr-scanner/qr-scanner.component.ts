import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketService, ValidateResponse } from '../../../core/services/ticket.service';

@Component({
    selector: 'app-qr-scanner',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header">
        <h1>📷 <span class="gradient-text">Ticket Scanner</span></h1>
        <p>Validate tickets by entering or scanning QR code data</p>
      </div>

      <div class="scanner-layout">
        <!-- Manual Entry -->
        <div class="glass-card" style="padding:32px;flex:1;min-width:350px">
          <h3 style="margin-bottom:16px">Manual QR Data Entry</h3>
          <p style="color:var(--text-secondary);margin-bottom:20px;font-size:0.9rem">
            Paste the QR code data string to validate a ticket
          </p>

          <div class="form-group">
            <label>QR Code Data</label>
            <textarea class="form-control" [(ngModel)]="qrInput"
                      placeholder="SCANTIX:ticket-id:event-id:user-id:signature"
                      rows="3"></textarea>
          </div>

          <button class="btn btn-primary" (click)="validate()" [disabled]="validating || !qrInput.trim()">
            @if (validating) {
              <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
            } @else {
              🔍 Validate Ticket
            }
          </button>
        </div>

        <!-- Result -->
        <div class="glass-card result-card" [class.valid]="result?.valid === true"
             [class.invalid]="result?.valid === false"
             style="padding:32px;flex:1;min-width:350px">
          @if (!result) {
            <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
              <span style="font-size:4rem;display:block;margin-bottom:16px">🔐</span>
              <p>Scan or enter a QR code to validate</p>
            </div>
          } @else {
            <div style="text-align:center">
              @if (result.valid) {
                <div class="result-icon valid-icon">✅</div>
                <h2 style="color:var(--success);margin-bottom:8px">Entry Granted!</h2>
              } @else {
                <div class="result-icon invalid-icon">❌</div>
                <h2 style="color:var(--danger);margin-bottom:8px">Entry Denied</h2>
              }

              <p style="color:var(--text-secondary);margin-bottom:24px;font-size:1.1rem">{{ result.message }}</p>

              @if (result.event_title) {
                <div class="result-detail">
                  <span class="detail-icon">🎪</span>
                  <span>{{ result.event_title }}</span>
                </div>
              }
              @if (result.attendee_name) {
                <div class="result-detail">
                  <span class="detail-icon">👤</span>
                  <span>{{ result.attendee_name }}</span>
                </div>
              }
              @if (result.ticket_id) {
                <div class="result-detail">
                  <span class="detail-icon">🎟️</span>
                  <span style="font-family:monospace;font-size:0.85rem">{{ result.ticket_id }}</span>
                </div>
              }

              <button class="btn btn-secondary" style="margin-top:24px" (click)="reset()">Scan Another</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .scanner-layout {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .result-card.valid {
      border-color: rgba(16, 185, 129, 0.3);
      background: rgba(16, 185, 129, 0.05);
    }
    .result-card.invalid {
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.05);
    }
    .result-icon {
      font-size: 4rem;
      margin-bottom: 16px;
    }
    .result-detail {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-card);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      justify-content: center;
    }
    .detail-icon { font-size: 1.2rem; }
  `]
})
export class QrScannerComponent {
    qrInput = '';
    result: ValidateResponse | null = null;
    validating = false;

    constructor(
        private ticketService: TicketService,
        private cdr: ChangeDetectorRef
    ) { }
    
    validate() {
        this.qrInput = this.qrInput.trim();
        if (!this.qrInput) return;

        this.validating = true;
        this.result = null;
        this.cdr.detectChanges();

        this.ticketService.validateTicket(this.qrInput).subscribe({
            next: (res) => {
                this.validating = false;
                this.result = res;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.validating = false;
                this.result = {
                    valid: false,
                    message: err.error?.message || 'Validation failed',
                    ticket_id: null,
                    event_title: null,
                    attendee_name: null
                };
                this.cdr.detectChanges();
            }
        });
    }

    reset() {
        this.qrInput = '';
        this.result = null;
    }
}
