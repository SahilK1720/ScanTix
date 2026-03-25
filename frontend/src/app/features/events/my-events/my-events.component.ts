import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-my-events',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div>
          <h1>📋 <span class="gradient-text">My Events</span></h1>
          <p>Manage and track your upcoming and past events.</p>
        </div>
        <div style="display:flex;gap:12px">
          <a routerLink="/organizer/bank-details" class="btn btn-secondary">🏦 Bank Details</a>
          <a routerLink="/events/create" class="btn btn-primary">➕ Create Event</a>
        </div>
      </div>

      <div class="tabs" style="margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;gap:32px">
        <button class="tab-btn" [class.active]="activeTab === 'upcoming'" (click)="activeTab = 'upcoming'">Upcoming</button>
        <button class="tab-btn" [class.active]="activeTab === 'past'" (click)="activeTab = 'past'">Past & Cancelled</button>
      </div>

      @if (loading) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading your events...</span></div>
      } @else if (filteredEvents.length === 0) {
        <div class="glass-card" style="padding:60px;text-align:center">
          <span style="font-size:4rem;display:block;margin-bottom:16px">{{ activeTab === 'upcoming' ? '🎪' : '📁' }}</span>
          <h2>No {{ activeTab }} events found</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">
            {{ activeTab === 'upcoming' ? 'Create your first event and start selling tickets!' : 'Any events you finish or cancel will appear here.' }}
          </p>
          @if (activeTab === 'upcoming') {
            <a routerLink="/events/create" class="btn btn-primary">Create Event</a>
          }
        </div>
      } @else {
        <!-- Summary row (only for upcoming) -->
        @if (activeTab === 'upcoming') {
          <div class="grid-4" style="margin-bottom:32px">
            <div class="stat-card glass-card">
              <div class="stat-label">Upcoming Events</div>
              <div class="stat-value gradient-text">{{ upcomingEvents.length }}</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-label">Tickets Sold</div>
              <div class="stat-value gradient-text">{{ totalSold }}</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-label">Total Revenue</div>
              <div class="stat-value" style="color:var(--success)">&#8377;{{ totalRevenue.toFixed(2) }}</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-label">Published</div>
              <div class="stat-value" style="color:var(--info)">{{ publishedCount }}</div>
            </div>
          </div>
        }

        <div style="display:flex;flex-direction:column;gap:16px">
          @for (event of filteredEvents; track event.id) {
            <div class="glass-card event-row" style="padding:24px" [class.cancelled-row]="event.status === 'cancelled'">
              <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:16px">
                <div style="flex:1;min-width:240px">
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <h3 style="font-size:1.1rem;margin:0">{{ event.title }}</h3>
                    <span class="badge" [ngClass]="getStatusBadgeClass(event)">{{ event.status.toUpperCase() }}</span>
                  </div>
                  @if (event.location) {
                    <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:4px">📍 {{ event.location }}</p>
                  }
                  <p style="font-size:0.85rem;color:var(--text-secondary)">📅 {{ event.event_date | date:'EEEE, MMM d, y' }} • {{ event.event_date | date:'h:mm a' }} IST</p>
                </div>

                <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap">
                  <div style="text-align:center">
                    <div style="font-size:1.4rem;font-weight:700;font-family:'Outfit',sans-serif" class="gradient-text">
                      {{ event.tickets_sold }}<span style="font-size:0.9rem;color:var(--text-muted)">/{{ event.max_tickets }}</span>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">TICKETS SOLD</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-size:1.4rem;font-weight:700;font-family:'Outfit',sans-serif;color:var(--success)">
                      &#8377;{{ getRevenue(event) }}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">REVENUE</div>
                  </div>
                  <div style="display:flex;gap:8px">
                    <a [routerLink]="['/events', event.id]" class="btn btn-secondary btn-sm">View</a>
                    <a [routerLink]="['/analytics', event.id]" class="btn btn-secondary btn-sm">📊 Stats</a>
                    @if (event.status !== 'cancelled' && !isPast(event)) {
                      <div class="dropdown-container">
                        <button class="btn btn-secondary btn-sm" (click)="toggleDropdown(event.id, $event)">⚙️ Actions</button>
                        @if (openDropdownId === event.id) {
                          <div class="dropdown-menu glass-card animate-fadeIn">
                            <a [routerLink]="['/events', event.id, 'edit']" class="dropdown-item">✏️ Update Event</a>
                            <button class="dropdown-item danger" (click)="openCancelModal(event)">🚫 Cancel Event</button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
              
              <!-- Occupancy bar -->
              <div style="margin-top:20px">
                <div class="occ-bar"><div class="occ-fill" [style.width.%]="(event.tickets_sold / event.max_tickets) * 100"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:6px">
                    <p style="font-size:0.75rem;color:var(--text-muted)">
                    {{ ((event.tickets_sold / event.max_tickets) * 100).toFixed(1) }}% occupancy &nbsp;·&nbsp; {{ event.max_tickets - event.tickets_sold }} remaining
                    </p>
                    @if (event.status === 'cancelled') {
                        <p style="font-size:0.75rem;color:var(--danger);font-weight:600">FULLY REFUNDED</p>
                    }
                </div>
              </div>
            </div>
          }
        </div>
      }

    </div>

    <!-- Cancellation Modal -->
    @if (selectedEventForCancel) {
      <div class="modal-backdrop" (click)="closeCancelModal()">
        <div class="modal-content glass-card animate-scaleIn" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>🚫 Cancel Event</h2>
            <button class="close-btn" (click)="closeCancelModal()">✕</button>
          </div>
          
          <div class="modal-body">
            <div class="warning-box">
              <p><strong>Are you sure you want to cancel "{{ selectedEventForCancel.title }}"?</strong></p>
              <ul style="margin:12px 0;padding-left:20px;font-size:0.9rem">
                @if (selectedEventForCancel.tickets_sold > 0) {
                  <li>All {{ selectedEventForCancel.tickets_sold }} attendees will receive a <strong>FULL REFUND</strong>.</li>
                  <li>A <strong>15% cancellation fee</strong> (₹{{ (totalRevenueFor(selectedEventForCancel) * 0.15).toFixed(2) }}) will be charged.</li>
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
    .occ-bar { height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
    .occ-fill { height:100%; background:var(--accent-gradient); border-radius:3px; transition:width 0.6s ease; }
    .event-row { transition:all 0.2s ease; border: 1px solid rgba(255,255,255,0.05); }
    .event-row:hover { border-color:rgba(234,179,8,0.25); transform: translateY(-2px); }
    .cancelled-row { opacity: 0.7; }
    
    .tab-btn { background:none; border:none; color:var(--text-muted); padding:12px 4px; font-size:1rem; cursor:pointer; position:relative; }
    .tab-btn.active { color:var(--text-primary); font-weight:600; }
    .tab-btn.active::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px; background:var(--accent-primary); }

    .dropdown-container { position:relative; }
    .dropdown-menu { position:absolute; right:0; top:calc(100% + 8px); width:200px; z-index:100; padding:8px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 30px rgba(0,0,0,0.5); background:#1e1e24; border-radius:12px; }
    .dropdown-item { display:block; padding:10px 12px; border-radius:6px; color:var(--text-primary); text-decoration:none; text-align:left; width:100%; background:none; border:none; cursor:pointer; font-size:0.9rem; transition: background 0.2s; }
    .dropdown-item:hover { background:rgba(255,255,255,0.05); }
    .dropdown-item.danger:hover { background:rgba(239,68,68,0.1); color:#fca5a5; }

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
export class MyEventsComponent implements OnInit {
  events: ScanEvent[] = [];
  loading = true;
  activeTab: 'upcoming' | 'past' = 'upcoming';
  openDropdownId: string | null = null;

  // Cancellation
  selectedEventForCancel: ScanEvent | null = null;
  cancelReason = '';
  cancelling = false;
  cancelError = '';

  constructor(
    private eventService: EventService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.fetchEvents();
    // Close dropdown on outside click
    window.addEventListener('click', () => this.openDropdownId = null);
  }

  fetchEvents() {
    this.loading = true;
    this.eventService.getMyEvents().subscribe({
      next: e => {
        this.events = e;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  get upcomingEvents() {
    const now = new Date();
    // Buffer of 2 hours for "upcoming" events that just started
    const buffer = 2 * 60 * 60 * 1000;
    return this.events.filter(e => e.status !== 'cancelled' && new Date(e.event_date).getTime() + buffer > now.getTime());
  }

  get pastEvents() {
    const now = new Date();
    const buffer = 2 * 60 * 60 * 1000;
    return this.events.filter(e => e.status === 'cancelled' || new Date(e.event_date).getTime() + buffer <= now.getTime());
  }

  get filteredEvents() {
    return this.activeTab === 'upcoming' ? this.upcomingEvents : this.pastEvents;
  }

  get totalSold() { return this.upcomingEvents.reduce((s, e) => s + e.tickets_sold, 0); }
  get totalRevenue() { return this.upcomingEvents.reduce((s, e) => s + parseFloat(e.ticket_price) * e.tickets_sold, 0); }
  get publishedCount() { return this.upcomingEvents.filter(e => e.status === 'published').length; }
  
  getStatusBadgeClass(event: ScanEvent) {
    if (event.status === 'cancelled') return 'badge-danger';
    if (this.isPast(event)) return 'badge-secondary';
    return event.status === 'published' ? 'badge-success' : 'badge-warning';
  }

  isPast(event: ScanEvent) {
    return new Date(event.event_date) <= new Date();
  }

  getRevenue(event: ScanEvent) { 
    return (parseFloat(event.ticket_price) * event.tickets_sold).toFixed(2); 
  }

  totalRevenueFor(event: ScanEvent) {
    return parseFloat(event.ticket_price) * event.tickets_sold;
  }

  toggleDropdown(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openDropdownId === id) {
      this.openDropdownId = null;
    } else {
      this.openDropdownId = id;
    }
  }

  openCancelModal(event: ScanEvent) {
    this.selectedEventForCancel = event;
    this.cancelReason = '';
    this.cancelError = '';
    this.openDropdownId = null;
  }

  closeCancelModal() {
    this.selectedEventForCancel = null;
  }

  confirmCancellation() {
    if (!this.selectedEventForCancel) return;
    
    this.cancelling = true;
    this.cancelError = '';
    
    this.eventService.cancelEvent(this.selectedEventForCancel.id, this.cancelReason).subscribe({
      next: () => {
        this.cancelling = false;
        this.closeCancelModal();
        this.fetchEvents(); // Refresh list
      },
      error: (err) => {
        this.cancelling = false;
        this.cancelError = err.error?.message || 'Failed to cancel event. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
