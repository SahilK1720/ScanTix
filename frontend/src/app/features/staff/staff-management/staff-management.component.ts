import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StaffService, EventStaff } from '../../../core/services/staff.service';
import { environment } from '../../../../environments/environment';

export function computeStaffStatus(staff: Pick<EventStaff, 'is_active' | 'is_revoked' | 'tickets_scanned' | 'last_active_at'>): 'Active' | 'Revoked' | 'Idle' {
  if (staff.is_revoked) return 'Revoked';
  if (staff.is_active && staff.tickets_scanned === 0 && !staff.last_active_at) return 'Idle';
  return 'Active';
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <!-- Toast notification -->
    @if (toast) {
      <div style="position:fixed;top:24px;right:24px;z-index:9999;background:var(--success);color:#fff;padding:12px 20px;border-radius:var(--radius-md);font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.4)">
        {{ toast }}
      </div>
    }

    <div class="glass-card" style="padding:32px;margin-top:32px">
      <h2 style="margin-bottom:8px">👥 <span class="gradient-text">Manage Staff</span></h2>
      <p style="color:var(--text-secondary);margin-bottom:28px;font-size:0.9rem">
        Add scanner staff for this event. They'll receive a personal scanner link via email.
      </p>

      <!-- Add Staff Form -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:32px">
        <div class="form-group" style="flex:1;min-width:160px;position:relative">
          <label>Name</label>
          <input class="form-control" formControlName="name" placeholder="Enter Name" />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <span style="color:var(--danger);font-size:0.78rem;position:absolute;bottom:-30px;left:0;white-space:nowrap">Name is required</span>
          }
        </div>
        <div class="form-group" style="flex:1;min-width:200px;position:relative">
          <label>Email</label>
          <input class="form-control" formControlName="email" type="email" placeholder="Enter Email" />
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <span style="color:var(--danger);font-size:0.78rem;position:absolute;bottom:-30px;left:0;white-space:nowrap">Valid email required</span>
          }
        </div>
        <div class="form-group" style="flex:1;min-width:160px;position:relative">
          <label>Phone</label>
          <input class="form-control" formControlName="phone_number" placeholder="Enter Phone Number" />
          @if (form.get('phone_number')?.invalid && form.get('phone_number')?.touched) {
            <span style="color:var(--danger);font-size:0.78rem;position:absolute;bottom:-30px;left:0;white-space:nowrap">Valid phone required</span>
          }
        </div>
        <div class="form-group" style="flex:0 0 auto">
          <button class="btn btn-primary" type="submit" [disabled]="submitting || form.invalid">
            @if (submitting) {
              <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
            } @else {
              ➕ Add Staff
            }
          </button>
        </div>
      </form>

      @if (formError) {
        <div style="color:var(--danger);margin-bottom:16px;font-size:0.9rem">{{ formError }}</div>
      }

      <!-- Staff Table -->
      @if (loading) {
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          <div class="spinner"></div>
        </div>
      } @else if (staffList.length === 0) {
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          No staff added yet. Add your first scanner above.
        </div>
      } @else {
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border-glass)">
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Name</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Email</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Phone</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Scanner Link</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Status</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Total Scans</th>
                <th style="text-align:left;padding:10px 12px;color:var(--text-secondary);font-weight:600">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (s of staffList; track s.id) {
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:12px">{{ s.name }}</td>
                  <td style="padding:12px;color:var(--text-secondary)">{{ s.email }}</td>
                  <td style="padding:12px;color:var(--text-secondary)">{{ s.phone_number }}</td>
                  <td style="padding:12px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:0.78rem;color:var(--text-muted);font-family:monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        {{ scannerLink(s) }}
                      </span>
                      <button class="btn btn-sm" title="Copy link"
                        style="background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.3);padding:3px 8px;font-size:0.75rem;white-space:nowrap"
                        (click)="copyLink(s)">
                        {{ copiedId === s.id ? '✅ Copied' : '📋 Copy' }}
                      </button>
                    </div>
                  </td>
                  <td style="padding:12px">
                    <span [style.color]="statusColor(s)" style="font-weight:600">{{ getStatus(s) }}</span>
                    @if (s.last_active_at) {
                      <div style="font-size:0.75rem;color:var(--text-muted)">Last seen: {{ timeAgo(s.last_active_at) }}</div>
                    }
                  </td>
                  <td style="padding:12px;text-align:center">{{ s.tickets_scanned }}</td>
                  <td style="padding:12px">
                    <div style="display:flex;gap:8px;align-items:center">
                      <a [routerLink]="['/my-events', eventId, 'staff', s.id, 'scans']" target="_blank" class="btn btn-sm" style="background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.25);padding:4px 10px;font-size:0.78rem;text-decoration:none;white-space:nowrap">
                        View Scans
                      </a>
                      @if (!s.is_revoked) {
                        <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.25);padding:4px 10px;font-size:0.78rem;white-space:nowrap"
                                (click)="revoke(s)" [disabled]="s['_busy']">
                          Revoke
                        </button>
                      } @else {
                        <button class="btn btn-sm" style="background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.25);padding:4px 10px;font-size:0.78rem;white-space:nowrap"
                                (click)="restore(s)" [disabled]="s['_busy']">
                          Restore
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class StaffManagementComponent implements OnInit {
  private _eventId: string = '';
  @Input() set eventId(val: string) {
    if (val && val !== this._eventId) {
      this._eventId = val;
      this.loadStaff();
    }
  }
  get eventId(): string { return this._eventId; }

  form: FormGroup;
  staffList: (EventStaff & { _busy?: boolean })[] = [];
  loading = true;
  submitting = false;
  toast: string | null = null;
  formError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private staffService: StaffService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone_number: ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]]
    });
  }

  ngOnInit() {}

  loadStaff() {
    this.loading = true;
    this.staffService.listStaff(this.eventId).subscribe({
      next: list => {
        this.staffList = list;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.formError = null;
    this.staffService.addStaff(this.eventId, this.form.value).subscribe({
      next: staff => {
        this.staffList = [...this.staffList, staff];
        this.form.reset();
        this.submitting = false;
        this.showToast('Staff member added & email sent');
        this.cdr.detectChanges();
      },
      error: err => {
        this.submitting = false;
        if (err.status === 409) {
          this.formError = 'This email is already registered as staff for this event';
        } else {
          this.formError = err.error?.message || 'Failed to add staff member';
        }
        this.cdr.detectChanges();
      }
    });
  }

  revoke(s: EventStaff & { _busy?: boolean }) {
    s._busy = true;
    this.staffService.revokeStaff(this.eventId, s.id).subscribe({
      next: updated => {
        const idx = this.staffList.findIndex(x => x.id === s.id);
        if (idx !== -1) this.staffList[idx] = { ...updated };
        this.cdr.detectChanges();
      },
      error: () => { s._busy = false; this.cdr.detectChanges(); }
    });
  }

  restore(s: EventStaff & { _busy?: boolean }) {
    s._busy = true;
    this.staffService.restoreStaff(this.eventId, s.id).subscribe({
      next: updated => {
        const idx = this.staffList.findIndex(x => x.id === s.id);
        if (idx !== -1) this.staffList[idx] = { ...updated };
        this.cdr.detectChanges();
      },
      error: () => { s._busy = false; this.cdr.detectChanges(); }
    });
  }

  remove(s: EventStaff & { _busy?: boolean }) {
    s._busy = true;
    this.staffService.deleteStaff(this.eventId, s.id).subscribe({
      next: () => {
        this.staffList = this.staffList.filter(x => x.id !== s.id);
        this.cdr.detectChanges();
      },
      error: () => { s._busy = false; this.cdr.detectChanges(); }
    });
  }

  getStatus(s: EventStaff): string {
    return computeStaffStatus(s);
  }

  statusColor(s: EventStaff): string {
    const st = computeStaffStatus(s);
    if (st === 'Active') return 'var(--success)';
    if (st === 'Revoked') return 'var(--danger)';
    return 'var(--text-muted)';
  }

  timeAgo(dateStr: string | null): string {
    return timeAgo(dateStr);
  }

  copiedId: string | null = null;

  scannerLink(s: EventStaff): string {
    const base = environment.apiUrl.replace('/api', '');
    return `${base}/scan/${s.access_token}`;
  }

  copyLink(s: EventStaff) {
    navigator.clipboard.writeText(this.scannerLink(s)).then(() => {
      this.copiedId = s.id;
      setTimeout(() => { this.copiedId = null; this.cdr.detectChanges(); }, 2000);
      this.cdr.detectChanges();
    });
  }

  private showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => { this.toast = null; this.cdr.detectChanges(); }, 3000);
  }
}
