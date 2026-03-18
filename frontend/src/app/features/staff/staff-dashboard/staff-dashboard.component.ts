import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';
import { ScanEvent } from '../../../core/services/event.service';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header">
        <h1>💂 <span class="gradient-text">Staff Dashboard</span></h1>
        <p>Select an event to start validating tickets</p>
      </div>

      @if (loading) {
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Loading assigned events...</p>
        </div>
      } @else if (events.length === 0) {
        <div class="glass-card empty-state">
          <span style="font-size: 3rem">🤷‍♂️</span>
          <h3>No events assigned</h3>
          <p>You haven't been assigned as staff to any events yet.</p>
        </div>
      } @else {
        <div class="event-grid">
          @for (event of events; track event.id) {
            <div class="glass-card event-card clickable" [routerLink]="['/staff/scan', event.id]">
              <div class="event-card-header">
                <span class="status-badge" [class.published]="event.status === 'published'">
                  {{ event.status | titlecase }}
                </span>
                <span class="date">{{ event.event_date | date:'EEEE, MMM d, y' }} • {{ event.event_date | date:'h:mm a' }} IST</span>
              </div>
              
              <h3 class="event-title">{{ event.title }}</h3>
              <p class="event-info">
                <span>📍 {{ event.location || 'Online' }}</span>
              </p>

              <div class="event-card-footer">
                <button class="btn btn-primary btn-block">
                  📷 Start Scanning
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .event-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }
    .event-card {
      transition: transform 0.2s;
      padding: 0;
      overflow: hidden;
    }
    .event-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border-color: var(--primary);
    }
    .event-card-header {
      padding: 20px 20px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .event-title {
      padding: 0 20px 10px;
      margin: 0;
      font-size: 1.4rem;
    }
    .event-info {
      padding: 0 20px 20px;
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(255,255,255,0.1);
    }
    .status-badge.published {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    .event-card-footer {
      padding: 20px;
      background: rgba(255,255,255,0.03);
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .empty-state {
      text-align: center;
      padding: 60px;
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
    }
  `]
})
export class StaffDashboardComponent implements OnInit {
  events: ScanEvent[] = [];
  loading = true;

  constructor(private staffService: StaffService) { }

  ngOnInit() {
    // Staff no longer have accounts — scanning is done via personal token links sent by email.
    this.loading = false;
  }
}
