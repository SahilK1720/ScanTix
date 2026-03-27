import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService, ScanEvent } from '../../core/services/event.service';
import { TicketService, Ticket } from '../../core/services/ticket.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ShinyTextComponent } from '../../shared/components/shiny-text/shiny-text.component';
import { DecryptedTextComponent } from '../../shared/components/decrypted-text/decrypted-text.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ShinyTextComponent, DecryptedTextComponent],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="welcome-header glass-card">
        <div class="welcome-top">
          <div class="welcome-text">
            <h1>
              <app-decrypted-text 
                [text]="'Welcome back, ' + auth.currentUser?.full_name + ' 👋'" 
                [speed]="40" 
                [maxIterations]="15"
                [sequential]="true"
                revealDirection="start"
                [useOriginalCharsOnly]="false"
                animateOn="view"
                characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$%&*"
                encryptedClassName="encrypted-color"
                className="revealed-color">
              </app-decrypted-text>
            </h1>
            <p class="subtitle">{{ auth.isOrganizer ? '' : 'Attendee Dashboard' }}</p>
          </div>
          <div class="role-badge" [class.organizer]="auth.isOrganizer">
            <app-shiny-text 
              [text]="(auth.role | uppercase)" 
              [color]="auth.role === 'organizer' ? '#b99813ff' : (auth.role === 'attendee' ? '#38bdf8' : '#ffffff')" 
              [shineColor]="auth.role === 'organizer' ? '#fcf19eff' : (auth.role === 'attendee' ? '#bae6fd' : '#ffffff')" 
              [speed]="auth.role === 'organizer' ? 3 : 5" 
              [spread]="auth.role === 'organizer' ? 1.5 : 2.5">
            </app-shiny-text>
          </div>
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
          <a routerLink="/organizer/bank-details" class="btn btn-secondary">🏦 Bank Details</a>
        </div>

        @if (myEvents.length > 0) {
          <h2 style="margin-bottom:16px;font-size:1.3rem">Recent Events</h2>
          <div class="grid-2">
            @for (event of myEvents.slice(0,4); track event.id) {
              <div class="stat-card glass-card organizer-event-card">
                <div class="card-header">
                  <div class="header-text">
                    <h3 class="event-title">{{ event.title }}</h3>
                    <p class="event-meta" style="margin-top: 8px">
                      📅 {{ event.event_date | date:'EEEE, MMM d, y' }}
                    </p>
                    <p class="event-meta">
                      ⏰ {{ event.event_date | date:'h:mm a' }} IST
                    </p>
                    @if (event.location) {
                      <p class="event-location" style="margin-top: 4px; margin-bottom: 8px">📍 {{ event.location }}</p>
                    }
                    <span class="badge" [class]="getStatusClass(event.status)" style="font-size: 0.65rem; padding: 2px 8px;">
                      {{ event.status.toUpperCase() }}
                    </span>
                  </div>
                  @if (event.image_urls[0]) {
                    <div class="event-thumbnail" [style.background-image]="'url(' + getImageUrl(event.image_urls[0]) + ')'"></div>
                  } @else {
                    <div class="event-thumbnail placeholder">🎟️</div>
                  }
                </div>
                
                <div style="flex-grow:1"></div>

                <div class="card-footer">
                  <div class="sales-section">
                    <div class="sales-info">
                      <span>🎟️ {{ event.tickets_sold }}/{{ event.max_tickets }} sold</span>
                      <span class="sales-pct">{{ ((event.tickets_sold / event.max_tickets) * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="prog-bar"><div class="prog-fill" [style.width.%]="(event.tickets_sold / event.max_tickets) * 100"></div></div>
                  </div>
                  
                  <div class="card-actions">
                    <a [routerLink]="['/events', event.id]" class="btn-dashboard btn-view">View</a>
                    <a [routerLink]="['/analytics', event.id]" class="btn-dashboard btn-analytics">📊 Analytics</a>
                  </div>
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
      }
    </div>
  `,
  styles: [`
    .welcome-header {
      padding: 32px;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .welcome-header::before {
      content: '';
      position: absolute; top: -100px; right: -100px;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .welcome-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .welcome-text h1 { margin: 0; font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; }
    .welcome-text .subtitle { margin-top: 4px; color: var(--text-muted); font-size: 1rem; }
    ::ng-deep .encrypted-color { color: #facc15; opacity: 0.7; font-family: monospace; }
    ::ng-deep .revealed-color { color: #ffffff; }
    .role-badge {
      display: flex; align-items: center; justify-content: center;
      padding: 6px 14px; border-radius: 30px;
      font-size: 0.72rem; font-weight: 800; letter-spacing: 0.8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #fff;
      min-width: 100px;
    }
    .role-badge.organizer {
      background: rgba(234, 179, 8, 0.08);
      border-color: rgba(234, 179, 8, 0.25);
      color: #facc15;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .prog-bar { height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
    .prog-fill { height:100%; background:var(--accent-gradient); border-radius:3px; transition:width 0.6s ease; }

    .organizer-event-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 20px;
      min-height: 320px;
    }
    .organizer-event-card:hover {
      transform: translateY(-8px);
      background: rgba(255,255,255,0.04);
      box-shadow: 0 20px 50px rgba(168, 85, 247, 0.2);
    }
    .card-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px; }
    .header-text { flex: 1; }
    .event-title { font-size: 1.15rem; font-weight: 700; margin: 0; color: #fff; }
    .event-meta { font-size: 0.82rem; color: #888; margin: 2px 0; }
    .event-location { font-size: 0.82rem; color: #666; margin: 0; }
    .event-thumbnail { width: 80px; height: 80px; border-radius: 12px; background-size: cover; background-position: center; background-color: #333; flex-shrink: 0; }
    .event-thumbnail.placeholder { display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }
    
    .card-footer { margin-top: auto; display: flex; flex-direction: column; padding-top: 16px; }
    .sales-section { margin-bottom: 8px; }
    .sales-info { display: flex; justify-content: space-between; font-size: 0.82rem; color: #999; margin-bottom: 8px; }
    .sales-pct { font-weight: 600; color: var(--accent-primary); }
    .card-actions { 
      display: flex; 
      gap: 12px; 
      justify-content: center; 
      padding-top: 16px; 
      border-top: 1px solid rgba(255,255,255,0.05); 
      margin-top: 12px;
    }
    .btn-dashboard {
      flex: 1;
      max-width: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.88rem;
      transition: all 0.2s;
      text-decoration: none;
    }
    .btn-view {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
    }
    .btn-view:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.3);
      transform: translateY(-2px);
    }
    .btn-analytics {
      background: rgba(234, 179, 8, 0.05);
      border: 1px solid rgba(234, 179, 8, 0.2);
      color: var(--accent-primary);
    }
    .btn-analytics:hover {
      background: rgba(234, 179, 8, 0.15);
      border-color: var(--accent-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(168, 85, 247, 0.2);
    }
  `]
})
export class DashboardComponent implements OnInit {
  myEvents: ScanEvent[] = [];

  constructor(
    public auth: AuthService,
    private eventService: EventService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (this.auth.isOrganizer) {
      this.eventService.getMyEvents().subscribe({
        next: e => { this.myEvents = e; this.cdr.detectChanges(); },
        error: () => { }
      });
    }
  }

  get totalSold() { return this.myEvents.reduce((sum, e) => sum + e.tickets_sold, 0); }
  get totalRevenue() { return this.myEvents.reduce((sum, e) => sum + (parseFloat(e.ticket_price) * e.tickets_sold), 0); }
  get activeEvents() { return this.myEvents.filter(e => e.status === 'published').length; }
  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path}`;
  }

  getStatusClass(s: string) { return s === 'published' ? 'badge-success' : s === 'draft' ? 'badge-warning' : s === 'cancelled' ? 'badge-danger' : 'badge-info'; }
}
