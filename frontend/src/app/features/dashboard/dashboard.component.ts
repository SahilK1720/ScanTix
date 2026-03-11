import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService, ScanEvent } from '../../core/services/event.service';
import { TicketService, Ticket } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h1>Welcome back, <span class="gradient-text">{{ auth.currentUser?.full_name }}</span> 👋</h1>
            <p>{{ auth.isOrganizer ? 'Organizer Dashboard' : 'Attendee Dashboard' }}</p>
          </div>
          <span class="badge" [class]="auth.isOrganizer ? 'badge-primary' : 'badge-success'" style="font-size:0.8rem">
            {{ auth.role | titlecase }}
          </span>
        </div>
      </div>

      <!-- ===== ORGANIZER VIEW ===== -->
      @if (auth.isOrganizer) {
        <div class="grid-4" style="margin-bottom:32px">
          <div class="stat-card glass-card">
            <div class="stat-label">Total Events</div>
            <div class="stat-value gradient-text">{{ myEvents.length }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Total Tickets Sold</div>
            <div class="stat-value gradient-text">{{ totalSold }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value" style="color:var(--success)">&#8377;{{ totalRevenue.toFixed(2) }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Active Events</div>
            <div class="stat-value" style="color:var(--info)">{{ activeEvents }}</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap">
          <a routerLink="/events/create" class="btn btn-primary">➕ Create New Event</a>
          <a routerLink="/my-events" class="btn btn-secondary">📋 My Events</a>
          <a routerLink="/scanner" class="btn btn-secondary">📷 Scan Tickets</a>
        </div>

        @if (myEvents.length > 0) {
          <h2 style="margin-bottom:16px;font-size:1.3rem">Recent Events</h2>
          <div class="grid-2">
            @for (event of myEvents.slice(0,4); track event.id) {
              <div class="glass-card" style="padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                  <h3 style="font-size:1.1rem">{{ event.title }}</h3>
                </div>
                @if (event.location) {
                  <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">📍 {{ event.location }}</p>
                }
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:12px">
                  📅 {{ event.event_date | date:'medium' }}
                </p>
                <div style="margin-bottom:12px">
                  <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">
                    <span>🎟️ {{ event.tickets_sold }}/{{ event.max_tickets }} sold</span>
                    <span>{{ ((event.tickets_sold / event.max_tickets) * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="prog-bar"><div class="prog-fill" [style.width.%]="(event.tickets_sold / event.max_tickets) * 100"></div></div>
                </div>
                <div style="display:flex;gap:8px">
                  <a [routerLink]="['/events', event.id]" class="btn btn-secondary btn-sm">View</a>
                  <a [routerLink]="['/analytics', event.id]" class="btn btn-secondary btn-sm">📊 Analytics</a>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="glass-card" style="padding:48px;text-align:center">
            <span style="font-size:3.5rem;display:block;margin-bottom:16px">🎪</span>
            <h2 style="margin-bottom:8px">No events yet</h2>
            <p style="color:var(--text-secondary);margin-bottom:24px">Create your first event and start selling tickets!</p>
            <a routerLink="/events/create" class="btn btn-primary">Create Event</a>
          </div>
        }

      <!-- ===== ATTENDEE VIEW ===== -->
      } @else {
        <div class="grid-4" style="margin-bottom:32px">
          <div class="stat-card glass-card">
            <div class="stat-label">My Tickets</div>
            <div class="stat-value gradient-text">{{ myTickets.length }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Valid</div>
            <div class="stat-value" style="color:var(--success)">{{ validTickets }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Used</div>
            <div class="stat-value" style="color:var(--info)">{{ usedTickets }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Events Attended</div>
            <div class="stat-value" style="color:var(--warning)">{{ eventsAttended }}</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap">
          <a routerLink="/events" class="btn btn-primary">🎪 Browse Events</a>
          <a routerLink="/my-tickets" class="btn btn-secondary">🎟️ My Tickets</a>
        </div>

        @if (myTickets.length > 0) {
          <h2 style="margin-bottom:16px;font-size:1.3rem">Recent Tickets</h2>
          <div class="grid-3">
            @for (ticket of myTickets.slice(0,6); track ticket.id) {
              <a [routerLink]="['/my-tickets']" [queryParams]="{id: ticket.id}"
                 class="glass-card ticket-item" style="padding:20px;display:block;text-decoration:none;color:inherit">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:1.3rem">🎟️</span>
                  <span class="badge" [class]="ticket.status === 'valid' ? 'badge-success' : ticket.status === 'used' ? 'badge-info' : 'badge-danger'">
                    {{ ticket.status }}
                  </span>
                </div>
                <p style="font-family:monospace;font-size:0.78rem;color:var(--text-muted)">{{ ticket.id.slice(0,16) }}...</p>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">{{ ticket.created_at | date:'mediumDate' }}</p>
              </a>
            }
          </div>
        } @else {
          <div class="glass-card" style="padding:48px;text-align:center">
            <span style="font-size:3.5rem;display:block;margin-bottom:16px">🎫</span>
            <h2 style="margin-bottom:8px">No tickets yet</h2>
            <p style="color:var(--text-secondary);margin-bottom:24px">Find an event you love and grab a ticket!</p>
            <a routerLink="/events" class="btn btn-primary">Browse Events</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .prog-bar { height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
    .prog-fill { height:100%; background:var(--accent-gradient); border-radius:3px; transition:width 0.6s ease; }
    .ticket-item:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(234,179,8,0.15); }
  `]
})
export class DashboardComponent implements OnInit {
  myEvents: ScanEvent[] = [];
  myTickets: Ticket[] = [];

  constructor(
    public auth: AuthService,
    private eventService: EventService,
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (this.auth.isOrganizer) {
      this.eventService.getMyEvents().subscribe({
        next: e => { this.myEvents = e; this.cdr.detectChanges(); },
        error: () => { }
      });
    }
    this.ticketService.getMyTickets().subscribe({
      next: t => { this.myTickets = t; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  get validTickets() { return this.myTickets.filter(t => t.status === 'valid').length; }
  get usedTickets() { return this.myTickets.filter(t => t.status === 'used').length; }
  get eventsAttended() { return new Set(this.myTickets.map(t => t.event_id)).size; }
  get totalSold() { return this.myEvents.reduce((sum, e) => sum + e.tickets_sold, 0); }
  get totalRevenue() { return this.myEvents.reduce((sum, e) => sum + (parseFloat(e.ticket_price) * e.tickets_sold), 0); }
  get activeEvents() { return this.myEvents.filter(e => e.status === 'published').length; }
  getStatusClass(s: string) { return s === 'published' ? 'badge-success' : s === 'draft' ? 'badge-warning' : s === 'cancelled' ? 'badge-danger' : 'badge-info'; }
}
