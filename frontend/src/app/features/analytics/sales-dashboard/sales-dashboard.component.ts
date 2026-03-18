import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { interval, Subscription, switchMap, startWith } from 'rxjs';
import { EventService, EventStats } from '../../../core/services/event.service';
import { StaffManagementComponent } from '../../staff/staff-management/staff-management.component';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, StaffManagementComponent],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <h1>📊 <span class="gradient-text">Sales Analytics</span></h1>
          <p>{{ stats?.title || 'Loading event...' }}</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--success)">
          <span class="live-dot"></span> Live · updates every 5s
        </div>
      </div>

      @if (!stats) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading analytics...</span></div>
      } @else {
        <!-- Stat Cards -->
        <div class="grid-4" style="margin-bottom:32px">
          <div class="stat-card glass-card">
            <div class="stat-label">Tickets Sold</div>
            <div class="stat-value gradient-text">{{ stats.tickets_sold }}</div>
            <div class="stat-change" style="color:var(--text-muted)">of {{ stats.max_tickets }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Revenue</div>
            <div class="stat-value" style="color:var(--success)">&#8377;{{ stats.revenue }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Remaining</div>
            <div class="stat-value" style="color:var(--warning)">{{ stats.remaining }}</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-label">Occupancy</div>
            <div class="stat-value" [style.color]="stats.occupancy_pct > 90 ? 'var(--danger)' : stats.occupancy_pct > 70 ? 'var(--warning)' : 'var(--info)'">
              {{ stats.occupancy_pct.toFixed(1) }}%
            </div>
          </div>
        </div>

        <!-- Occupancy Bar -->
        <div class="glass-card" style="padding:32px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <h3>Capacity &amp; Occupancy</h3>
            <span style="font-weight:700;font-size:1.1rem">{{ stats.tickets_sold }} / {{ stats.max_tickets }}</span>
          </div>
          <div class="cap-bar">
            <div class="cap-fill"
                 [style.width.%]="stats.occupancy_pct"
                 [style.background]="stats.occupancy_pct > 90 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : stats.occupancy_pct > 70 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'var(--accent-gradient)'">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:0.82rem;color:var(--text-muted)">
            <span>0% Empty</span>
            <span [style.color]="stats.occupancy_pct > 90 ? 'var(--danger)' : 'var(--success)'">
              {{ stats.occupancy_pct > 90 ? '🔥 Almost Sold Out!' : stats.occupancy_pct > 70 ? '⚡ Selling Fast' : '✅ Good Availability' }}
            </span>
            <span>100% Full</span>
          </div>
        </div>

        <!-- Visual breakdown -->
        <div class="grid-2">
          <div class="glass-card" style="padding:24px">
            <h3 style="margin-bottom:20px">Ticket Breakdown</h3>
            <div class="breakdown-row">
              <span style="color:var(--success)">🎟️ Sold</span>
              <div class="breakdown-bar"><div class="bd-fill bd-sold" [style.width.%]="stats.occupancy_pct"></div></div>
              <span style="font-weight:600">{{ stats.tickets_sold }}</span>
            </div>
            <div class="breakdown-row">
              <span style="color:var(--text-muted)">⬜ Remaining</span>
              <div class="breakdown-bar"><div class="bd-fill bd-rem" [style.width.%]="100 - stats.occupancy_pct"></div></div>
              <span style="font-weight:600">{{ stats.remaining }}</span>
            </div>
          </div>

          <div class="glass-card" style="padding:24px">
            <h3 style="margin-bottom:20px">Revenue Summary</h3>
            <div style="display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border-glass)">
                <span style="color:var(--text-secondary)">Gross Revenue</span>
                <span style="font-size:1.5rem;font-weight:700;color:var(--success)">&#8377;{{ stats.revenue }}</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:var(--text-secondary)">Avg. per Ticket</span>
                <span style="font-weight:600">&#8377;{{ avgPerTicket(stats) }}</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:var(--text-secondary)">Potential (100%)</span>
                <span style="font-weight:600;color:var(--text-muted)">&#8377;{{ potentialRevenue(stats) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align:center;margin-top:24px">
          <a routerLink="/my-events" class="btn btn-secondary">← Back to My Events</a>
        </div>

        <!-- Staff Management -->
        <h2 style="margin-top:40px;margin-bottom:0">🧑‍💼 <span class="gradient-text">Manage Staff</span></h2>
        <app-staff-management [eventId]="eventId" />
      }
    </div>
  `,
  styles: [`
    .live-dot { width:8px; height:8px; border-radius:50%; background:var(--success); display:inline-block; animation:pulse 1.5s ease infinite; }
    .cap-bar { height:16px; background:rgba(255,255,255,0.06); border-radius:8px; overflow:hidden; }
    .cap-fill { height:100%; border-radius:8px; transition:width 1s ease; }
    .breakdown-row { display:flex; align-items:center; gap:12px; margin-bottom:14px; font-size:0.88rem; }
    .breakdown-bar { flex:1; height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; }
    .bd-fill { height:100%; border-radius:4px; transition:width 1s ease; }
    .bd-sold { background:linear-gradient(90deg,#eab308,#facc15); }
    .bd-rem { background:rgba(255,255,255,0.1); }
  `]
})
export class SalesDashboardComponent implements OnInit, OnDestroy {
  stats: EventStats | null = null;
  eventId: string = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.eventId = id;
    this.sub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.eventService.getEventStats(id))
    ).subscribe({
      next: s => {
        this.stats = s;
        this.cdr.detectChanges();
      },
      error: e => {
        console.error('Failed to load stats', e);
        this.cdr.detectChanges();
      }
    });
  }

  avgPerTicket(s: EventStats): string {
    return s.tickets_sold > 0 ? (parseFloat(s.revenue) / s.tickets_sold).toFixed(2) : '0.00';
  }

  potentialRevenue(s: EventStats): string {
    return (parseFloat(s.revenue) / (s.occupancy_pct / 100 || 1)).toFixed(2);
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
