import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-my-events',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div>
          <h1>📋 <span class="gradient-text">My Events</span></h1>
          <p>Manage your created events</p>
        </div>
        <a routerLink="/events/create" class="btn btn-primary">➕ Create Event</a>
      </div>

      @if (loading) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading your events...</span></div>
      } @else if (events.length === 0) {
        <div class="glass-card" style="padding:60px;text-align:center">
          <span style="font-size:4rem;display:block;margin-bottom:16px">🎪</span>
          <h2>No events created yet</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">Create your first event and start selling tickets!</p>
          <a routerLink="/events/create" class="btn btn-primary">Create Event</a>
        </div>
      } @else {
        <!-- Summary row -->
        <div class="grid-4" style="margin-bottom:32px">
          <div class="stat-card glass-card">
            <div class="stat-label">Total Events</div>
            <div class="stat-value gradient-text">{{ events.length }}</div>
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

        <div style="display:flex;flex-direction:column;gap:16px">
          @for (event of events; track event.id) {
            <div class="glass-card event-row" style="padding:24px">
              <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:16px">
                <div style="flex:1;min-width:240px">
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <h3 style="font-size:1.1rem">{{ event.title }}</h3>
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
                  </div>
                </div>
              </div>
              <!-- Occupancy bar -->
              <div style="margin-top:16px">
                <div class="occ-bar"><div class="occ-fill" [style.width.%]="(event.tickets_sold / event.max_tickets) * 100"></div></div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
                  {{ ((event.tickets_sold / event.max_tickets) * 100).toFixed(1) }}% occupancy &nbsp;·&nbsp; {{ event.max_tickets - event.tickets_sold }} remaining
                </p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .occ-bar { height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
    .occ-fill { height:100%; background:var(--accent-gradient); border-radius:3px; transition:width 0.6s ease; }
    .event-row { transition:all 0.2s ease; }
    .event-row:hover { border-color:rgba(234,179,8,0.25); }
  `]
})
export class MyEventsComponent implements OnInit {
  events: ScanEvent[] = [];
  loading = true;

  constructor(
    private eventService: EventService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.eventService.getMyEvents().subscribe({
      next: e => {
        const now = new Date();
        this.events = e.filter(event => new Date(event.event_date) > now);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  get totalSold() { return this.events.reduce((s, e) => s + e.tickets_sold, 0); }
  get totalRevenue() { return this.events.reduce((s, e) => s + parseFloat(e.ticket_price) * e.tickets_sold, 0); }
  get publishedCount() { return this.events.filter(e => e.status === 'published').length; }
  getStatusClass(s: string) { return s === 'published' ? 'badge-success' : s === 'draft' ? 'badge-warning' : 'badge-danger'; }
  getRevenue(event: ScanEvent) { return (parseFloat(event.ticket_price) * event.tickets_sold).toFixed(2); }
}
