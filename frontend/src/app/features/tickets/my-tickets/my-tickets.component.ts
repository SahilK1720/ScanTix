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

      <!-- Organizer Cancellation Banners -->
        <div class="organizer-cancel-banners" style="margin-bottom:32px; display: flex; flex-direction: column; gap: 16px;">
          @for (event of cancelledByOrganizerEvents; track event.id) {
            <div class="glass-card banner-item animate-fadeIn" style="border-left:4px solid #ef4444;background:rgba(239,68,68,0.1);padding:20px;display:flex;justify-content:space-between;align-items:center;gap:20px;">
              <div style="display:flex;gap:16px;align-items:center">
                <span style="font-size:2rem">📢</span>
                <div>
                  <h3 style="margin:0;color:#fca5a5;font-size:1.1rem">Event Cancelled: {{ event.title }}</h3>
                  <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.9rem">
                    The organizer has cancelled this event. Full refunds for all your tickets have been initiated.
                  </p>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <button class="btn btn-secondary btn-sm" (click)="scrollToEvent(event.id)">View Tickets</button>
                <button (click)="dismissNotification(event.id, $event)" 
                        style="background: none; border: none; color: #9ca3af; cursor: pointer; padding: 6px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; border-radius: 50%;"
                        onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#9ca3af'; this.style.background='none'">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          }
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
          <div class="stat-card glass-card stat-total">
            <div class="stat-label">Total Tickets</div>
            <div class="stat-value gradient-text">{{ tickets.length }}</div>
          </div>
          <div class="stat-card glass-card stat-active">
            <div class="stat-label">Active</div>
            <div class="stat-value" style="color:var(--success)">{{ validCount }}</div>
          </div>
          <div class="stat-card glass-card stat-used">
            <div class="stat-label">Used</div>
            <div class="stat-value" style="color:var(--info)">{{ usedCount }}</div>
          </div>
          <div class="stat-card glass-card stat-cancelled">
            <div class="stat-label">Cancelled</div>
            <div class="stat-value" style="color:var(--danger)">{{ cancelledCount }}</div>
          </div>
        </div>

        <div class="grid-2">
          @for (ticket of tickets; track ticket.id) {
            <div [id]="'ticket-card-' + ticket.id" [attr.data-event-id]="ticket.event_id" class="ticket-premium-card animate-fadeIn"
                 [class.card-active]="ticket.status === 'active' || ticket.status === 'valid'"
                 [class.card-used]="ticket.status === 'used'"
                 [class.card-cancelled]="ticket.status === 'cancelled'"
                 (click)="openTicket(ticket)">
              
              <div class="card-content">
                <!-- Top Header: Title and Image -->
                <div class="card-header">
                  <div class="header-text">
                    <h2 class="event-name">{{ ticket.event_title }}</h2>
                    <p class="event-meta">
                      {{ ticket.event_date || ticket.created_at | date:'dd MMM' }} | {{ ticket.event_date || ticket.created_at | date:'hh:mm a' }}
                    </p>
                    <p class="ticket-qty">1 ticket</p>
                  </div>
                  
                  @if (ticket.event_image) {
                    <div class="event-thumbnail" [style.background-image]="'url(' + getImageUrl(ticket.event_image) + ')'"></div>
                  } @else {
                    <div class="event-thumbnail placeholder">🎟️</div>
                  }
                </div>

                <!-- Middle Section: Location -->
                <div class="location-section">
                  <span class="label">Location</span>
                  <div class="location-row">
                    <p class="venue-name">{{ ticket.event_location || 'Venue details pending' }}</p>
                    @if (ticket.google_maps_url) {
                      <a [href]="ticket.google_maps_url" target="_blank" (click)="$event.stopPropagation()" class="map-link">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" transform="rotate(45 12 12)"/>
                          <path d="M10 15V13a2 2 0 0 1 2-2h3"/>
                          <path d="M13 8l3 3-3 3"/>
                        </svg>
                      </a>
                    } @else {
                      <div class="map-link disabled">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" transform="rotate(45 12 12)"/>
                        </svg>
                      </div>
                    }
                  </div>
                </div>

                <!-- Footer: Status and Action -->
                <div class="card-footer">
                  <div class="status-badge" [class.cancelled]="ticket.status === 'cancelled'" [class.used]="ticket.status === 'used'" [class.active]="ticket.status === 'active' || ticket.status === 'valid'">
                    @if (ticket.status === 'cancelled' && ticket.event_status === 'cancelled') {
                      Organizer Cancelled
                    } @else {
                      {{ (ticket.status === 'valid' ? 'Active' : ticket.status | titlecase) }}
                    }
                  </div>

                  <div class="view-details">
                    <span>View details</span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

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
                  @if (qrData.event_status === 'cancelled') {
                    <div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:12px; padding:16px; margin-bottom:20px; text-align:left; display:flex; gap:12px; align-items:start">
                      <span style="font-size:1.5rem">🚨</span>
                      <div>
                        <p style="margin:0; font-weight:700; color:#fca5a5; font-size:0.95rem">Event Cancelled by Organizer</p>
                        <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary); line-height:1.4">
                          This event has been cancelled by the organizer. A <strong>full refund</strong> for your booking has been initiated to your source account.
                        </p>
                      </div>
                    </div>
                  }

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
                <div class="verification-banner animate-fadeIn" style="display:inline-flex; align-items:center; gap:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); padding:10px 16px; border-radius:14px; margin-top:20px; box-shadow: 0 4px 15px rgba(16,185,129,0.05);">
                  <div style="background:#10b981; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; box-shadow:0 0 10px rgba(16,185,129,0.4)">
                    ✓
                  </div>
                  <div style="text-align:left">
                    <span style="display:block; font-weight:700; color:#10b981; font-size:0.85rem; letter-spacing:0.3px; text-transform:uppercase;">Scan Verified</span>
                    <span style="display:block; color:var(--text-secondary); font-size:0.78rem; font-weight:500; margin-top:1px;">
                      {{ selectedTicket.scanned_at | date:'EEEE, MMM d, y' }} • {{ selectedTicket.scanned_at | date:'h:mm a' }} IST
                    </span>
                  </div>
                </div>
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
  `,
  styles: [`
    .grid-2 { display:grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap:24px; }
    @media (max-width: 500px) { .grid-2 { grid-template-columns: 1fr; } }

    .stat-card {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .stat-card:hover {
      transform: translateY(-4px);
      background: rgba(255,255,255,0.03);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
    .stat-card.stat-total:hover {
      border-color: rgba(234, 179, 8, 0.4);
      background: rgba(234, 179, 8, 0.05);
      box-shadow: 0 12px 40px rgba(234, 179, 8, 0.15);
    }
    .stat-card.stat-active:hover {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.05);
      box-shadow: 0 12px 40px rgba(16, 185, 129, 0.15);
    }
    .stat-card.stat-used:hover {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(96, 165, 250, 0.05);
      box-shadow: 0 12px 40px rgba(96, 165, 250, 0.15);
    }
    .stat-card.stat-cancelled:hover {
      border-color: rgba(248, 113, 113, 0.4);
      background: rgba(248, 113, 113, 0.05);
      box-shadow: 0 12px 40px rgba(248, 113, 113, 0.15);
    }

    .ticket-premium-card {
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ticket-premium-card:hover {
      background: #222;
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }

    .ticket-premium-card.card-active:hover {
      border-color: rgba(52, 211, 153, 0.4);
      background: rgba(52, 211, 153, 0.05);
      box-shadow: 0 12px 40px rgba(52, 211, 153, 0.15);
    }
    .ticket-premium-card.card-used:hover {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(96, 165, 250, 0.05);
      box-shadow: 0 12px 40px rgba(96, 165, 250, 0.15);
    }
    .ticket-premium-card.card-cancelled:hover {
      border-color: rgba(248, 113, 113, 0.4);
      background: rgba(248, 113, 113, 0.05);
      box-shadow: 0 12px 40px rgba(248, 113, 113, 0.15);
    }

    .card-content { padding: 24px; }

    .card-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }
    .header-text { flex: 1; }
    .event-name {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 8px;
      color: #fff;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .event-meta {
      font-size: 0.95rem;
      color: #999;
      margin: 0 0 4px;
    }
    .ticket-qty {
      font-size: 0.95rem;
      color: #666;
      margin: 0;
    }

    .event-thumbnail {
      width: 90px;
      height: 90px;
      border-radius: 12px;
      background-size: cover;
      background-position: center;
      background-color: #333;
      flex-shrink: 0;
    }
    .event-thumbnail.placeholder {
      display: flex; align-items: center; justify-content: center; font-size: 2rem;
    }

    .location-section {
      margin-bottom: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .location-section .label {
      font-size: 0.8rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      display: block;
    }
    .location-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .venue-name {
      font-size: 1.05rem;
      color: #ddd;
      margin: 0;
      font-weight: 500;
    }
    .map-link {
      color: #999;
      transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(255,255,255,0.03);
    }
    .map-link:hover:not(.disabled) {
      color: #fff;
      background: rgba(255,255,255,0.08);
      transform: scale(1.1);
    }
    .map-link.disabled { opacity: 0.3; cursor: not-allowed; }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
    }
    .status-badge {
      padding: 6px 14px;
      background: rgba(255,255,255,0.06);
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #999;
    }
    .status-badge.active { color: #10b981; background: rgba(16, 185, 129, 0.1); }
    .status-badge.used { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
    .status-badge.cancelled { color: #f87171; background: rgba(248, 113, 113, 0.1); }

    .view-details {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 600;
      transition: gap 0.2s;
    }
    .ticket-premium-card:hover .view-details { gap: 8px; }

    .organizer-overlay {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #ef4444;
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      z-index: 5;
    }

    .modal-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,0.8);
      backdrop-filter:blur(8px); z-index:200;
      display:flex; align-items:flex-start; justify-content:center; padding:16px;
      padding-top: 13vh;
    }
    .modal-card {
      width:100%; max-width:420px; padding:0;
      max-height: 85vh;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
      border: 1px solid var(--border-glass);
      background: rgba(26,26,26,0.95);
      border-radius: 24px;
      position:relative; animation:fadeIn 0.2s ease;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .modal-card::-webkit-scrollbar { width: 6px; }
    .modal-card::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
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
  dismissedEventIds = new Set<string>();

  // Notification logic
  get cancelledByOrganizerEvents() {
    const cancelled = this.tickets.filter(t => t.event_status === 'cancelled' && !this.dismissedEventIds.has(t.event_id));
    const uniqueEvents = new Map();
    cancelled.forEach(t => {
      if (!uniqueEvents.has(t.event_id)) {
        uniqueEvents.set(t.event_id, { id: t.event_id, title: t.event_title });
      }
    });
    return Array.from(uniqueEvents.values());
  }

  dismissNotification(eventId: string, event: MouseEvent) {
    event.stopPropagation();
    this.dismissedEventIds.add(eventId);
    // Persist to local storage so it doesn't show up again on reload
    localStorage.setItem('dismissed_event_notifications', JSON.stringify(Array.from(this.dismissedEventIds)));
    this.cdr.detectChanges();
  }

  scrollToEvent(eventId: string) {
    const ticketCards = document.querySelectorAll(`[data-event-id="${eventId}"]`);
    if (ticketCards.length > 0) {
      // Scroll to the first one found
      ticketCards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight all of them with a red glow and scale effect
      ticketCards.forEach(el => {
        const card = el as HTMLElement;
        card.style.boxShadow = '0 0 50px rgba(239, 68, 68, 0.45)';
        card.style.borderColor = 'rgba(239, 68, 68, 0.7)';
        card.style.transform = 'translateY(-12px) scale(1.02)';
        card.style.zIndex = '10';
        
        setTimeout(() => {
          card.style.boxShadow = '';
          card.style.borderColor = '';
          card.style.transform = '';
          card.style.zIndex = '';
        }, 3000);
      });
    }
  }

  constructor(
    private ticketService: TicketService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Load dismissed notifications from local storage
    const saved = localStorage.getItem('dismissed_event_notifications');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          this.dismissedEventIds = new Set(ids);
        }
      } catch (e) {
        console.error('Error parsing dismissed notifications', e);
      }
    }

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
