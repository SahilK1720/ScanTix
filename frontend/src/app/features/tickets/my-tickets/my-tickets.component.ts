import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TicketService, Ticket, TicketWithQr, CancellationPreview } from '../../../core/services/ticket.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header">
        <h1>🎟️ <span class="gradient-text">My Tickets</span></h1>
        <p>View and manage your purchased tickets</p>
      </div>

      @if (loading) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading tickets...</span></div>
      } @else if (tickets.length === 0) {
        <div class="glass-card" style="padding:60px;text-align:center">
          <span style="font-size:4rem;display:block;margin-bottom:16px">🎫</span>
          <h2>No tickets yet</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">Browse events and grab your tickets!</p>
          <a routerLink="/events" class="btn btn-primary">Browse Events</a>
        </div>
      } @else {
        <!-- Stats row -->
        <div class="grid-4" style="margin-bottom:24px">
          <div class="stat-card glass-card">
            <div class="stat-label">Total Tickets</div>
            <div class="stat-value gradient-text">{{ tickets.length }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Active</div>
            <div class="stat-value" style="color:var(--success)">{{ validCount }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Used</div>
            <div class="stat-value" style="color:var(--info)">{{ usedCount }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Cancelled</div>
            <div class="stat-value" style="color:var(--danger)">{{ cancelledCount }}</div>
          </div>
        </div>

        <div class="grid-3">
          @for (ticket of tickets; track ticket.id) {
            <div class="glass-card ticket-card" style="padding:0;overflow:hidden;cursor:pointer"
                 (click)="openTicket(ticket)">
              <!-- Top stripe -->
              <div class="ticket-stripe" [class]="(ticket.status === 'active' || ticket.status === 'valid') ? 'stripe-green' : ticket.status === 'used' ? 'stripe-blue' : 'stripe-red'"></div>

              <div style="padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                  <span style="font-size:2rem">🎟️</span>
                  <div style="display:flex;gap:8px">
                    @if (ticket.ticket_type === 'vip') {
                      <span class="badge badge-warning" style="background:#eab308;color:#000">VIP</span>
                    }
                    <span class="badge" [class]="(ticket.status === 'active' || ticket.status === 'valid') ? 'badge-success' : ticket.status === 'used' ? 'badge-info' : 'badge-danger'">
                      {{ ticket.status | uppercase }}
                    </span>
                    @if (ticket.refund_status === 'refunded') {
                      <span class="badge badge-info">REFUNDED</span>
                    }
                  </div>
                </div>

                <p style="font-size:0.82rem;color:var(--text-secondary)">
                  📅 {{ ticket.event_date || ticket.created_at | date:'EEEE, MMM d, y' }} • {{ ticket.event_date || ticket.created_at | date:'h:mm a' }} IST
                </p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px">
                  @if (ticket.status === 'cancelled') {
                    <p style="font-size:0.78rem;color:#5eead4;margin:0;font-weight:500">
                      Tap to view refund status →
                    </p>
                  } @else {
                    <p style="font-size:0.78rem;color:var(--accent-primary);margin:0;font-weight:500">
                      Tap to view QR code →
                    </p>
                  }
                  
                  @if (ticket.status === 'active' || ticket.status === 'valid') {
                    <button class="icon-btn" (click)="openCancelModal(ticket, $event)" title="Cancel Ticket" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="display:block;">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8z"/>
                      </svg>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- QR Modal -->
      @if (selectedTicket) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card glass-card" (click)="$event.stopPropagation()">
            <button class="modal-close" (click)="closeModal()" style="z-index: 10; background: rgba(0,0,0,0.5); color: white; border: none;">✕</button>

            <div class="modal-content-wrapper">
            @if (qrLoading) {
              <div class="loading-overlay" style="padding:60px"><div class="spinner"></div></div>
            } @else if (qrData) {
              <!-- Event Banner -->
              @if (qrData.event_image) {
                <div [style.background-image]="'url(' + getImageUrl(qrData.event_image) + ')'" 
                     style="height: 120px; background-size: cover; background-position: center; border-bottom: 2px solid var(--border-glass);">
                </div>
              } @else {
                <div style="height: 100px; background: var(--accent-gradient); display:flex; align-items:center; justify-content:center; border-bottom: 2px solid var(--border-glass);">
                  <span style="font-size:3rem">🎟️</span>
                </div>
              }

              <div style="padding: 20px; text-align: center;">
                <h2 style="margin-bottom: 4px; font-size: 1.4rem; white-space: pre-wrap;">{{ qrData.event_title }}</h2>
                <div style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9rem;">
                  📅 {{ qrData.event_date | date:'EEEE, MMM d, y' }} • {{ qrData.event_date | date:'h:mm a' }} IST
                </div>

                <div style="display:flex; gap:8px; justify-content:center; margin-bottom: 20px; flex-wrap: wrap;">
                  @if (selectedTicket.ticket_type === 'vip') {
                    <span class="badge badge-warning" style="background:#eab308;color:#000; padding: 4px 10px; font-size: 0.75rem;">VIP</span>
                  }
                  <span class="badge"
                    [class]="(selectedTicket.status === 'active' || selectedTicket.status === 'valid') ? 'badge-success' : selectedTicket.status === 'used' ? 'badge-info' : 'badge-danger'"
                        style="padding: 4px 10px; font-size: 0.75rem;">
                    {{ selectedTicket.status | uppercase }}
                  </span>
                  @if (qrData.seat_label) {
                    <span class="badge badge-info" style="border-color: #3b82f6; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 4px 10px; font-size: 0.75rem;">
                      🪑 {{ qrData.seat_label }}
                    </span>
                  }
                </div>

                @if (selectedTicket.status === 'cancelled') {
                  <div class="refund-panel">
                    <div class="refund-head">
                      <div>
                        <p class="refund-title">Refund Status</p>
                        <p class="refund-meta">Ticket #{{ selectedTicket.id.slice(0, 12) }}...</p>
                      </div>
                      <span class="refund-pill" [class]="refundPillClass(selectedTicket.refund_status)">
                        {{ refundLabel(selectedTicket.refund_status) }}
                      </span>
                    </div>

                    <div class="refund-timeline">
                      <div class="refund-step">
                        <span class="dot" [class.completed]="isRefundStepCompleted(selectedTicket.refund_status, 1)"></span>
                        <div>
                          <p class="step-title">Cancellation request submitted</p>
                          <p class="step-time">{{ selectedTicket.created_at | date:'d MMM y, h:mm a' }}</p>
                        </div>
                      </div>

                      <div class="refund-step">
                        <span class="dot" [class.completed]="isRefundStepCompleted(selectedTicket.refund_status, 2)"></span>
                        <div>
                          <p class="step-title">Gateway is processing your refund</p>
                          <p class="step-time">Status updates when Razorpay confirms settlement</p>
                        </div>
                      </div>

                      <div class="refund-step">
                        <span class="dot" [class.completed]="isRefundStepCompleted(selectedTicket.refund_status, 3)"></span>
                        <div>
                          <p class="step-title">Refund credited to source account</p>
                          <p class="step-time">Final credit time depends on bank settlement cycle</p>
                        </div>
                      </div>
                    </div>

                    @if (selectedTicket.refund_status === 'none') {
                      <p class="refund-note">This cancellation is not eligible for monetary refund under the event refund policy.</p>
                    }

                    <button class="btn btn-secondary refund-refresh-btn" (click)="refreshRefundStatus(selectedTicket)">
                      Refresh Refund Status
                    </button>
                  </div>
                } @else {
                  <div class="qr-wrapper" style="padding: 12px;">
                    <img [src]="'data:image/png;base64,' + qrData.qr_image_base64" alt="QR Code" class="qr-img">
                  </div>
                }

                @if (selectedTicket.status !== 'cancelled') {
                  <p style="font-family:monospace; color:var(--text-muted); font-size:0.75rem; margin-top:16px; word-break: break-all;">
                    Ticket ID: #{{ selectedTicket.id }}
                  </p>
                }

                @if (selectedTicket.status === 'used' && selectedTicket.scanned_at) {
                  <p style="color:var(--info);font-size:0.8rem;margin-top:12px; font-weight: 500;">
                    ✅ Scanned on {{ selectedTicket.scanned_at | date:'EEEE, MMM d, y' }} • {{ selectedTicket.scanned_at | date:'h:mm a' }} IST
                  </p>
                } @else if (selectedTicket.status !== 'cancelled') {
                  <p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">
                    Show this QR code at the event entrance
                  </p>
                }
                
                @if (selectedTicket.status === 'active' || selectedTicket.status === 'valid') {
                  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-glass);">
                    <button class="btn btn-outline-danger" style="width: 100%; border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; gap: 8px;" (click)="openCancelModal(selectedTicket, $event)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                      Cancel Booking
                    </button>
                    <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 8px;">Cancellation policies apply based on event terms</p>
                  </div>
                }
              </div>
            }
            </div>
          </div>
        </div>
      }

      <!-- Cancellation Confirmation Modal -->
      @if (cancelTarget && cancellationPreview) {
        <div class="modal-backdrop" (click)="closeCancelModal()">
          <div class="modal-card glass-card" (click)="$event.stopPropagation()" style="max-width:520px;padding:24px">
            <h3 style="margin-bottom:8px">Cancel Ticket Confirmation</h3>
            <p style="color:var(--text-secondary);margin-bottom:12px">
              Ticket #{{ cancelTarget.id.slice(0, 12) }}...
            </p>

            <div style="padding:12px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;background:rgba(255,255,255,0.03)">
              <p style="margin:0 0 6px"><strong>Refund Amount:</strong> ₹{{ formatMoney(cancellationPreview.refund_amount) }}</p>
              <p style="margin:0;color:var(--text-muted)">{{ cancellationPreview.reason }}</p>
            </div>

            <p style="color:var(--text-muted);font-size:0.85rem;margin-top:10px;margin-bottom:16px">
              Refunds are allowed only for refundable events and only if cancellation is at least 24 hours before event start.
            </p>

            @if (cancelError) {
              <div class="alert alert-danger" style="margin-bottom:12px">{{ cancelError }}</div>
            }

            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button class="btn btn-secondary" (click)="closeCancelModal()" [disabled]="cancelLoading">Keep Ticket</button>
              <button class="btn btn-danger" (click)="confirmCancel()" [disabled]="cancelLoading || !cancellationPreview.can_cancel">
                @if (cancelLoading) {
                  <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
                } @else {
                  Confirm Cancellation
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .ticket-card { transition:all 0.2s ease; }
    .ticket-card:hover { transform:translateY(-4px); box-shadow:0 8px 30px rgba(234,179,8,0.2); }
    .ticket-stripe { height:5px; }
    .stripe-green { background: linear-gradient(90deg, #10b981, #059669); }
    .stripe-blue { background: linear-gradient(90deg, #06b6d4, #0891b2); }
    .stripe-red { background: linear-gradient(90deg, #ef4444, #dc2626); }

    .modal-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,0.8);
      backdrop-filter:blur(8px); z-index:200;
      display:flex; align-items:center; justify-content:center; padding:16px;
    }
    .modal-card {
      width:100%; max-width:400px; padding:0; margin: auto;
      max-height: calc(100vh - 32px);
      display: flex; flex-direction: column; overflow: hidden;
      position:relative; animation:fadeIn 0.2s ease;
    }
    .modal-content-wrapper {
      overflow-y: auto; flex: 1; width: 100%; position: relative;
    }
    .modal-close {
      position:absolute; top:12px; right:12px;
      background:rgba(0,0,0,0.5); border:1px solid var(--border-glass);
      color: white; border-radius:50%;
      width:32px; height:32px; cursor:pointer; font-size:0.9rem;
      display:flex; align-items:center; justify-content:center;
      transition:all 0.2s; z-index: 10;
    }
    .modal-close:hover { background:rgba(0,0,0,0.8); }
    .qr-wrapper { background:white; border-radius:12px; display:inline-block; }
    .qr-img { width:160px; height:160px; image-rendering:pixelated; display:inline-block; vertical-align: middle; }
    
    .icon-btn:hover { background: rgba(239, 68, 68, 0.1) !important; color: #ef4444 !important; }
    .btn-outline-danger { transition: all 0.2s; }
    .btn-outline-danger:hover { background: rgba(239, 68, 68, 0.2) !important; }

    .refund-panel {
      margin: 18px 0 8px;
      text-align: left;
      border: 1px solid rgba(94, 234, 212, 0.25);
      border-radius: 14px;
      padding: 14px;
      background: linear-gradient(180deg, rgba(20, 30, 30, 0.6), rgba(12, 20, 25, 0.65));
    }
    .refund-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }
    .refund-title {
      margin: 0;
      color: #f3f4f6;
      font-size: 0.98rem;
      font-weight: 700;
    }
    .refund-meta {
      margin: 4px 0 0;
      color: #9ca3af;
      font-size: 0.74rem;
    }
    .refund-pill {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 0.73rem;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .pill-pending {
      color: #f59e0b;
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.14);
    }
    .pill-refunded {
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.14);
    }
    .pill-none {
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.14);
    }
    .refund-timeline {
      position: relative;
      margin-left: 4px;
    }
    .refund-step {
      position: relative;
      display: grid;
      grid-template-columns: 16px 1fr;
      gap: 10px;
      padding-bottom: 13px;
    }
    .refund-step:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 15px;
      width: 2px;
      height: calc(100% - 2px);
      background: rgba(148, 163, 184, 0.32);
    }
    .dot {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid rgba(148, 163, 184, 0.6);
      background: rgba(15, 23, 42, 0.8);
      margin-top: 1px;
    }
    .dot.completed {
      border-color: #10b981;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }
    .step-title {
      margin: 0;
      color: #f3f4f6;
      font-size: 0.84rem;
      font-weight: 600;
    }
    .step-time {
      margin: 3px 0 0;
      color: #94a3b8;
      font-size: 0.72rem;
    }
    .refund-note {
      margin: 6px 0 0;
      color: #fca5a5;
      font-size: 0.76rem;
      line-height: 1.4;
    }
    .refund-refresh-btn {
      margin-top: 12px;
      width: 100%;
    }
  `]
})
export class MyTicketsComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  qrData: TicketWithQr | null = null;
  loading = true;
  qrLoading = false;
  cancelTarget: Ticket | null = null;
  cancellationPreview: CancellationPreview | null = null;
  cancelLoading = false;
  cancelError = '';
  private statusPollInterval: any;

  constructor(
    private ticketService: TicketService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.ticketService.getMyTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.loading = false;
        const id = this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.paramMap.get('id');
        if (id) {
          const t = tickets.find(t => t.id === id);
          if (t) this.openTicket(t);
        }
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openTicket(ticket: Ticket) {
    this.selectedTicket = ticket;
    this.qrData = null;
    this.qrLoading = true;
    this.cdr.detectChanges();
    this.ticketService.getTicketQr(ticket.id).subscribe({
      next: (data) => { 
        this.qrData = data; 
        this.selectedTicket = { ...this.selectedTicket!, status: data.ticket.status, scanned_at: data.ticket.scanned_at };
        this.qrLoading = false; 
        this.cdr.detectChanges(); 
        
        // Start polling if ticket is active
        this.startStatusPolling();
      },
      error: () => { this.qrLoading = false; this.cdr.detectChanges(); }
    });
  }

  private startStatusPolling() {
    this.stopStatusPolling();
    // Only poll if the ticket is still active or valid
    if (this.selectedTicket && (this.selectedTicket.status === 'active' || this.selectedTicket.status === 'valid')) {
      this.statusPollInterval = setInterval(() => {
        if (!this.selectedTicket) {
          this.stopStatusPolling();
          return;
        }
        this.ticketService.getTicketQr(this.selectedTicket.id).subscribe({
          next: (data) => {
            if (this.selectedTicket && (this.selectedTicket.status !== data.ticket.status)) {
              this.selectedTicket = { ...this.selectedTicket, status: data.ticket.status, scanned_at: data.ticket.scanned_at };
              
              // Also update the ticket in the main list
              const idx = this.tickets.findIndex(t => t.id === this.selectedTicket!.id);
              if (idx >= 0) {
                this.tickets[idx] = { ...this.tickets[idx], status: data.ticket.status, scanned_at: data.ticket.scanned_at };
              }
              
              this.cdr.detectChanges();
              if (data.ticket.status === 'used' || data.ticket.status === 'cancelled') {
                this.stopStatusPolling();
              }
            }
          }
        });
      }, 3000); // Poll every 3 seconds
    }
  }

  private stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
  }

  closeModal() { 
    this.selectedTicket = null; 
    this.qrData = null; 
    this.stopStatusPolling();
  }

  ngOnDestroy() {
    this.stopStatusPolling();
  }

  openCancelModal(ticket: Ticket, event: MouseEvent) {
    event.stopPropagation();
    this.cancelTarget = ticket;
    this.cancellationPreview = null;
    this.cancelError = '';
    this.cancelLoading = true;
    this.cdr.detectChanges();

    this.ticketService.getCancellationPreview(ticket.id).subscribe({
      next: (preview) => {
        this.cancellationPreview = preview;
        this.cancelLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cancelLoading = false;
        this.cancelError = err.error?.message || 'Failed to load cancellation details.';
        this.cdr.detectChanges();
      }
    });
  }

  confirmCancel() {
    if (!this.cancelTarget) return;
    this.cancelLoading = true;
    this.cancelError = '';
    this.cdr.detectChanges();

    this.ticketService.cancelTicket(this.cancelTarget.id).subscribe({
      next: (res) => {
        const idx = this.tickets.findIndex(t => t.id === this.cancelTarget!.id);
        if (idx >= 0) {
          this.tickets[idx] = {
            ...this.tickets[idx],
            status: 'cancelled',
            refund_status: res.refund_status
          };
        }
        
        // Also update the currently open modal ticket if it matches
        if (this.selectedTicket && this.selectedTicket.id === this.cancelTarget!.id) {
          this.selectedTicket = {
            ...this.selectedTicket,
            status: 'cancelled',
            refund_status: res.refund_status
          };
        }

        this.closeCancelModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cancelLoading = false;
        this.cancelError = err.error?.message || 'Failed to cancel ticket.';
        this.cdr.detectChanges();
      }
    });
  }

  closeCancelModal() {
    this.cancelTarget = null;
    this.cancellationPreview = null;
    this.cancelLoading = false;
    this.cancelError = '';
  }

  get validCount() { return this.tickets.filter(t => t.status === 'active' || t.status === 'valid').length; }
  get usedCount() { return this.tickets.filter(t => t.status === 'used').length; }
  get cancelledCount() { return this.tickets.filter(t => t.status === 'cancelled').length; }

  formatMoney(amount: string): string {
    const value = Number(amount);
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  getImageUrl(path: string): string {
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path}`;
  }

  refreshRefundStatus(ticket: Ticket) {
    this.ticketService.syncRefundStatus(ticket.id).subscribe({
      next: (res) => {
        ticket.refund_status = res.refund_status;
        this.cdr.detectChanges();
      },
      error: () => {
        // Optionally show error
        this.cdr.detectChanges();
      }
    });
  }

  refundLabel(status: Ticket['refund_status']): string {
    if (status === 'refunded') return 'Completed';
    if (status === 'pending') return 'Processing';
    return 'Not Eligible';
  }

  refundPillClass(status: Ticket['refund_status']): string {
    if (status === 'refunded') return 'refund-pill pill-refunded';
    if (status === 'pending') return 'refund-pill pill-pending';
    return 'refund-pill pill-none';
  }

  isRefundStepCompleted(status: Ticket['refund_status'], step: number): boolean {
    if (status === 'none') return false;
    if (status === 'pending') return step <= 2;
    return step <= 3;
  }
}
