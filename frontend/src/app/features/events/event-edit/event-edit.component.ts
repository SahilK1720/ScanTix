import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { EventService, UpdateEventPayload, ScanEvent } from '../../../core/services/event.service';

@Component({
  selector: 'app-event-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="text-align: center; margin-bottom: 32px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px">
          <h1>✏️ <span class="gradient-text">Update Event</span></h1>
          @if (ticketsSold > 0) {
            <span class="badge badge-warning">LOCKED FIELDS</span>
          }
        </div>
        <p>Update your event details. Some fields are locked once tickets are sold.</p>
      </div>

      <div class="glass-card" style="padding:40px;max-width:760px;margin: 0 auto;">
        @if (error) { <div class="alert alert-danger">{{ error }}</div> }
        @if (success) { <div class="alert alert-success">{{ success }}</div> }

        @if (initialLoading) {
          <div style="text-align:center;padding:40px">
            <div class="spinner"></div>
            <p>Loading event data...</p>
          </div>
        } @else {
          <form #eventForm="ngForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label>Event Title *</label>
              <input class="form-control" [(ngModel)]="title" name="title" placeholder="Event Title" required>
            </div>

            <div class="form-group">
              <label>Description *</label>
              <textarea class="form-control" [(ngModel)]="description" name="description"
                        placeholder="Tell attendees what makes this event special..." rows="4" required></textarea>
            </div>

            <div class="form-group">
              <label>📍 Location *</label>
              <input class="form-control" [(ngModel)]="location" name="location"
                     [disabled]="ticketsSold > 0"
                     placeholder="e.g. Phoenix Marketcity, Pune" required>
              @if (ticketsSold > 0) {
                <small class="form-hint" style="color:var(--warning)">Location cannot be changed after tickets are sold.</small>
              }
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div class="form-group">
                <label>Event Date & Time *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="eventDate" name="event_date" 
                       [disabled]="ticketsSold > 0" required>
                @if (ticketsSold > 0) {
                  <small class="form-hint" style="color:var(--warning)">Date cannot be changed after tickets are sold.</small>
                }
              </div>
              <div class="form-group">
                <label>Max Tickets *</label>
                <input type="number" class="form-control" [(ngModel)]="maxTickets" name="max_tickets"
                       placeholder="500" required>
                @if (ticketsSold > 0) {
                  <small class="form-hint">Must be at least {{ ticketsSold }} (already sold).</small>
                }
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div class="form-group">
                <label>🚪 Gate Opens At *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="gateOpenTime" name="gate_open_time"
                       [disabled]="ticketsSold > 0" required>
              </div>
              <div class="form-group">
                <label>🏁 Event Ends At *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="eventEndTime" name="event_end_time"
                       [disabled]="ticketsSold > 0" required>
              </div>
            </div>

            <div class="form-group">
              <label>🗺️ Google Maps Venue Link *</label>
              <input type="url" class="form-control" [(ngModel)]="googleMapsUrl" name="google_maps_url"
                     placeholder="https://maps.google.com/..." required>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div class="form-group">
                <label>Ticket Price (₹) *</label>
                <input type="number" class="form-control" [(ngModel)]="ticketPrice"
                       [disabled]="ticketsSold > 0" name="ticket_price" required>
              </div>
              <div class="form-group">
                <label>VIP Price (₹) *</label>
                <input type="number" class="form-control" [(ngModel)]="vipPrice"
                       [disabled]="ticketsSold > 0" name="vip_price" required>
              </div>
            </div>

            <div class="form-group">
              <label>Refund Policy *</label>
              <select class="form-control" [(ngModel)]="refundPolicy" name="refund_policy" required>
                <option value="NON_REFUNDABLE">🔒 Non-Refundable</option>
                <option value="REFUNDABLE">💸 Refundable (– 24h)</option>
              </select>
            </div>

            <div style="display:flex;gap:12px;margin-top:32px;justify-content:space-between;align-items:center;flex-wrap:wrap">
              <div style="display:flex;gap:12px">
                <button type="submit" class="btn btn-primary btn-lg" [disabled]="loading || !eventForm.valid">
                  @if (loading) { <span class="spinner"></span> Saving... } 
                  @else { ✅ Update Event }
                </button>
                <button type="button" class="btn btn-secondary btn-lg" (click)="cancel()">Back</button>
              </div>
              
              @if (ticketsSold >= 0) {
                <button type="button" class="btn btn-danger" (click)="openCancelModal()">🚫 Cancel Event</button>
              }
            </div>
          </form>
        }
      </div>
    </div>

    <!-- Cancellation Modal -->
    @if (showCancelModal) {
      <div class="modal-backdrop" (click)="closeCancelModal()">
        <div class="modal-content glass-card animate-scaleIn" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>🚫 Cancel Event</h2>
            <button class="close-btn" (click)="closeCancelModal()">✕</button>
          </div>
          
          <div class="modal-body">
            <div class="warning-box">
              <p><strong>Are you sure you want to cancel "{{ title }}"?</strong></p>
              <ul style="margin:12px 0;padding-left:20px;font-size:0.9rem;color:#fca5a5">
                @if (ticketsSold > 0) {
                  <li>All {{ ticketsSold }} attendees will receive a <strong>FULL REFUND</strong>.</li>
                  <li>A <strong>15% cancellation fee</strong> (₹{{ (totalRevenue() * 0.15).toFixed(2) }}) will be charged from your account.</li>
                } @else {
                  <li>No tickets have been sold yet. No penalty will be charged.</li>
                }
                <li>This action <strong>cannot be undone</strong>.</li>
              </ul>
            </div>

            <div class="form-group" style="margin-top:20px">
              <label>Reason for Cancellation (Optional)</label>
              <textarea class="form-control" [(ngModel)]="cancelReason" placeholder="e.g. Unforeseen circumstances, venue issue..." rows="3"></textarea>
            </div>

            @if (cancelError) {
              <div class="error-banner" style="margin-top:16px">{{ cancelError }}</div>
            }
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeCancelModal()" [disabled]="cancelling">Go Back</button>
            <button class="btn btn-danger" (click)="confirmCancellation()" [disabled]="cancelling">
              @if (cancelling) { <span class="spinner-sm"></span> Processing... }
              @else { 🚨 Confirm Cancellation }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .form-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: block; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 0.95rem; }
    .alert-danger { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); color: #fca5a5; }
    .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); color: #86efac; }

    /* Modal Styles */
    .modal-backdrop { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding:20px; padding-top: 8vh; }
    .modal-content { width:100%; max-width:500px; padding:32px; position:relative; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .modal-header h2 { margin:0; font-size:1.5rem; }
    .close-btn { background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer; }
    .warning-box { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:20px; border-radius:12px; color:#fca5a5; }
    .modal-footer { display:flex; gap:12px; margin-top:32px; justify-content:flex-end; }
    .btn-danger { background:var(--danger); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:600; cursor:pointer; font-family:'Outfit',sans-serif; }
    .btn-danger:hover { background:#dc2626; box-shadow:0 0 15px rgba(239,68,68,0.4); }
    .btn-danger:disabled { opacity:0.6; cursor:not-allowed; }
    .error-banner { background:rgba(239,68,68,0.15); color:#fca5a5; padding:12px; border-radius:8px; font-size:0.85rem; border:1px solid var(--danger); }
    .spinner-sm { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `]
})
export class EventEditComponent implements OnInit {
  eventId: string = '';
  ticketsSold: number = 0;
  
  title = '';
  description = '';
  location = '';
  eventDate = '';
  gateOpenTime = '';
  eventEndTime = '';
  googleMapsUrl = '';
  maxTickets: number | null = null;
  ticketPrice: number | null = null;
  vipPrice: number | null = null;
  refundPolicy: 'REFUNDABLE' | 'NON_REFUNDABLE' = 'NON_REFUNDABLE';
  
  initialLoading = true;
  loading = false;
  error = '';
  success = '';

  // Cancellation
  showCancelModal = false;
  cancelReason = '';
  cancelling = false;
  cancelError = '';

  constructor(
    private eventService: EventService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.eventId = this.route.snapshot.params['id'];
    this.fetchEvent();
  }

  fetchEvent() {
    this.initialLoading = true;
    this.eventService.getEvent(this.eventId).subscribe({
      next: (event) => {
        this.ticketsSold = event.tickets_sold;
        this.title = event.title;
        this.description = event.description || '';
        this.location = event.location || '';
        this.eventDate = this.formatDate(event.event_date);
        this.gateOpenTime = this.formatDate(event.gate_open_time || '');
        this.eventEndTime = this.formatDate(event.event_end_time || '');
        this.googleMapsUrl = event.google_maps_url || '';
        this.maxTickets = event.max_tickets;
        this.ticketPrice = parseFloat(event.ticket_price || '0');
        this.vipPrice = parseFloat(event.vip_price || '0');
        this.refundPolicy = event.refund_policy as any || 'NON_REFUNDABLE';
        
        this.initialLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load event details.';
        this.initialLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.success = '';

    const payload: UpdateEventPayload = {
      title: this.title,
      description: this.description,
      location: this.location || undefined,
      event_date: new Date(this.eventDate).toISOString(),
      gate_open_time: new Date(this.gateOpenTime).toISOString(),
      event_end_time: new Date(this.eventEndTime).toISOString(),
      google_maps_url: this.googleMapsUrl || undefined,
      max_tickets: this.maxTickets!,
      ticket_price: this.ticketPrice!,
      vip_price: this.vipPrice!,
      refund_policy: this.refundPolicy,
    };

    this.eventService.updateEvent(this.eventId, payload).subscribe({
      next: () => {
        this.success = 'Event updated successfully!';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/events/my']), 1500);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update event. Please check for sold ticket restrictions.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel() {
    this.router.navigate(['/my-events']);
  }

  // Cancellation Methods
  openCancelModal() {
    this.showCancelModal = true;
    this.cancelReason = '';
    this.cancelError = '';
    this.cdr.detectChanges();
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.cdr.detectChanges();
  }

  totalRevenue() {
    return (this.ticketPrice || 0) * this.ticketsSold;
  }

  confirmCancellation() {
    this.cancelling = true;
    this.cancelError = '';
    
    this.eventService.cancelEvent(this.eventId, this.cancelReason).subscribe({
      next: () => {
        this.cancelling = false;
        this.showCancelModal = false;
        this.success = 'Event cancelled successfully. Redirecting...';
        setTimeout(() => this.router.navigate(['/my-events']), 2000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cancelling = false;
        this.cancelError = err.error?.message || 'Failed to cancel event. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
