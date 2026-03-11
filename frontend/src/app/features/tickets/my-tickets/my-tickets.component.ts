import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TicketService, Ticket, TicketWithQr } from '../../../core/services/ticket.service';
import { EventService, ScanEvent } from '../../../core/services/event.service';
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
            <div class="stat-label">Valid</div>
            <div class="stat-value" style="color:var(--success)">{{ validCount }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Used</div>
            <div class="stat-value" style="color:var(--info)">{{ usedCount }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Events</div>
            <div class="stat-value" style="color:var(--warning)">{{ eventCount }}</div>
          </div>
        </div>

        <div class="grid-3">
          @for (ticket of tickets; track ticket.id) {
            <div class="glass-card ticket-card" style="padding:0;overflow:hidden;cursor:pointer"
                 (click)="openTicket(ticket)">
              <!-- Top stripe -->
              <div class="ticket-stripe" [class]="ticket.status === 'valid' ? 'stripe-green' : ticket.status === 'used' ? 'stripe-blue' : 'stripe-red'"></div>

              <div style="padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                  <span style="font-size:2rem">🎟️</span>
                  <div style="display:flex;gap:8px">
                    @if (ticket.ticket_type === 'vip') {
                      <span class="badge badge-warning" style="background:#eab308;color:#000">VIP</span>
                    }
                    <span class="badge" [class]="ticket.status === 'valid' ? 'badge-success' : ticket.status === 'used' ? 'badge-info' : 'badge-danger'">
                      {{ ticket.status | uppercase }}
                    </span>
                  </div>
                </div>

                <p style="font-size:0.78rem;color:var(--text-muted);font-family:monospace;margin-bottom:8px">
                  #{{ ticket.id.slice(0, 16) }}...
                </p>
                <p style="font-size:0.82rem;color:var(--text-secondary)">
                  📅 {{ ticket.created_at | date:'mediumDate' }}
                </p>
                <p style="font-size:0.78rem;color:var(--accent-primary);margin-top:8px;font-weight:500">
                  Tap to view QR code →
                </p>
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
                  📅 {{ qrData.event_date | date:'mediumDate' }} • {{ qrData.event_date | date:'shortTime' }}
                </div>

                <div style="display:flex; gap:8px; justify-content:center; margin-bottom: 20px; flex-wrap: wrap;">
                  @if (selectedTicket.ticket_type === 'vip') {
                    <span class="badge badge-warning" style="background:#eab308;color:#000; padding: 4px 10px; font-size: 0.75rem;">VIP</span>
                  }
                  <span class="badge"
                        [class]="selectedTicket.status === 'valid' ? 'badge-success' : selectedTicket.status === 'used' ? 'badge-info' : 'badge-danger'"
                        style="padding: 4px 10px; font-size: 0.75rem;">
                    {{ selectedTicket.status | uppercase }}
                  </span>
                  @if (qrData.seat_label) {
                    <span class="badge badge-info" style="border-color: #3b82f6; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 4px 10px; font-size: 0.75rem;">
                      🪑 {{ qrData.seat_label }}
                    </span>
                  }
                </div>

                <div class="qr-wrapper" style="padding: 12px;">
                  <img [src]="'data:image/png;base64,' + qrData.qr_image_base64" alt="QR Code" class="qr-img">
                </div>
                
                <p style="font-family:monospace; color:var(--text-muted); font-size:0.75rem; margin-top:16px; word-break: break-all;">
                  ID: #{{ selectedTicket.id }}
                </p>

                @if (selectedTicket.status === 'used' && selectedTicket.scanned_at) {
                  <p style="color:var(--info);font-size:0.8rem;margin-top:12px; font-weight: 500;">
                    ✅ Scanned on {{ selectedTicket.scanned_at | date:'medium' }}
                  </p>
                } @else {
                  <p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">
                    Show this QR code at the event entrance
                  </p>
                }
              </div>
            }
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
  `]
})
export class MyTicketsComponent implements OnInit {
  tickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  qrData: TicketWithQr | null = null;
  loading = true;
  qrLoading = false;

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
      next: (data) => { this.qrData = data; this.qrLoading = false; this.cdr.detectChanges(); },
      error: () => { this.qrLoading = false; this.cdr.detectChanges(); }
    });
  }

  closeModal() { this.selectedTicket = null; this.qrData = null; }

  get validCount() { return this.tickets.filter(t => t.status === 'valid').length; }
  get usedCount() { return this.tickets.filter(t => t.status === 'used').length; }
  get eventCount() { return new Set(this.tickets.map(t => t.event_id)).size; }

  getImageUrl(path: string): string {
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path}`;
  }
}
