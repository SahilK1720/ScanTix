import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { interval, Subscription, switchMap, startWith } from 'rxjs';
import { StaffService, ScannedAttendee } from '../../../core/services/staff.service';

@Component({
  selector: 'app-staff-scans',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;margin-bottom:32px">
        <div>
          <a [routerLink]="['/analytics', eventId]" class="btn btn-sm" style="background:transparent;padding:0;color:var(--text-muted);margin-bottom:12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
            ← Back to Event Analytics
          </a>
          <h1 style="margin-bottom:8px">📋 <span class="gradient-text">Scanned Attendees</span></h1>
          <p style="font-size:1.05rem;color:var(--text-secondary)">
            Tickets validated by <strong style="color:var(--text-primary)">{{ staffName || 'this staff member' }}</strong>
          </p>
          <div style="font-size:0.82rem;color:var(--success);margin-top:8px;display:flex;align-items:center;gap:6px;background:rgba(16,185,129,0.08);padding:4px 10px;border-radius:20px;width:fit-content;border:1px solid rgba(16,185,129,0.15)">
            <span class="live-dot"></span> Live
          </div>
        </div>

        @if (attendees.length > 0) {
          <div class="glass-card" style="padding:16px 24px;display:flex;align-items:center;gap:24px">
            <div style="text-align:center">
              <div style="color:var(--text-secondary);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Scans</div>
              <div style="font-size:1.8rem;font-weight:700" class="gradient-text">{{ attendees.length }}</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border-glass)"></div>
            <div style="text-align:center">
              <div style="color:var(--text-secondary);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Last Scan</div>
              <div style="font-size:0.9rem;font-weight:600;color:var(--text-primary)">{{ attendees[0].scanned_at | date:'shortTime' }}</div>
            </div>
          </div>
        }
      </div>

      @if (loading && !attendees.length) {
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          <div class="spinner"></div><span style="margin-left:8px">Loading scan logs...</span>
        </div>
      } @else if (error) {
        <div style="color:var(--danger);padding:24px;background:rgba(239, 68, 68, 0.1);border-radius:12px">
          {{ error }}
        </div>
      } @else if (attendees.length === 0) {
        <div class="glass-card" style="text-align:center;padding:48px;color:var(--text-muted)">
          <div style="font-size:3rem;margin-bottom:16px">📭</div>
          <p>No tickets have been scanned by this staff member yet.</p>
        </div>
      } @else {
        <div class="glass-card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.92rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border-glass)">
                <th style="text-align:left;padding:16px;color:var(--text-secondary);font-weight:600">Ticket ID</th>
                <th style="text-align:left;padding:16px;color:var(--text-secondary);font-weight:600">Attendee Name</th>
                <th style="text-align:left;padding:16px;color:var(--text-secondary);font-weight:600">Email</th>
                <th style="text-align:left;padding:16px;color:var(--text-secondary);font-weight:600">Ticket Type</th>
                <th style="text-align:right;padding:16px;color:var(--text-secondary);font-weight:600">Scanned At</th>
              </tr>
            </thead>
            <tbody>
              @for (a of attendees; track a.ticket_id) {
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:16px">
                    <div style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:4px;display:inline-block" [title]="a.ticket_id">
                      {{ a.ticket_id.split('-')[0] | uppercase }}
                    </div>
                  </td>
                  <td style="padding:16px;font-weight:500">{{ a.attendee_name }}</td>
                  <td style="padding:16px;color:var(--text-secondary)">{{ a.attendee_email }}</td>
                  <td style="padding:16px">
                    <span [style.background]="a.ticket_type === 'VIP' ? 'rgba(217, 70, 239, 0.15)' : 'rgba(255, 255, 255, 0.1)'"
                          [style.color]="a.ticket_type === 'VIP' ? '#d946ef' : 'var(--text-primary)'"
                          style="padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600">
                      {{ a.ticket_type === 'VIP' ? '⭐ VIP' : '🎫 Regular' }}
                    </span>
                  </td>
                  <td style="padding:16px;text-align:right;color:var(--text-secondary);font-family:monospace">
                    {{ a.scanned_at | date:'medium' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .live-dot { width:8px; height:8px; border-radius:50%; background:var(--success); display:inline-block; animation:pulse 1.5s ease infinite; }
  `]
})
export class StaffScansComponent implements OnInit, OnDestroy {
  attendees: ScannedAttendee[] = [];
  staffName: string = '';
  loading = true;
  error: string | null = null;
  eventId: string = '';
  staffId: string = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private staffService: StaffService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id')!;
    this.staffId = this.route.snapshot.paramMap.get('staffId')!;

    if (!this.eventId || !this.staffId) {
      this.error = 'Invalid route parameters';
      this.loading = false;
      return;
    }

    this.sub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.staffService.getScannedAttendees(this.eventId, this.staffId))
    ).subscribe({
      next: (data) => {
        this.staffName = data.staff_name;
        this.attendees = data.attendees;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (this.attendees.length === 0) {
          this.error = err.error?.message || 'Failed to load scanned attendees';
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
