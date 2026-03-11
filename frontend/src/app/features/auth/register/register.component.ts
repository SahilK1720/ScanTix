import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card glass-card animate-fadeIn">
        <div class="auth-header">
          <span class="auth-icon">🚀</span>
          <h1 class="gradient-text">Create Account</h1>
          <p>Join ScanTix today</p>
        </div>

        @if (error) { <div class="alert alert-danger">{{ error }}</div> }

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input id="fullName" type="text" class="form-control"
                   [(ngModel)]="fullName" name="fullName" placeholder="John Doe" required>
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input id="email" type="email" class="form-control"
                   [(ngModel)]="email" name="email" placeholder="you@example.com" required>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" class="form-control"
                   [(ngModel)]="password" name="password" placeholder="Min. 6 characters" required>
          </div>

          <!-- Role Selector -->
          <div class="form-group">
            <label>I want to</label>
            <div class="role-selector">
              <div class="role-option" [class.selected]="role === 'attendee'" (click)="role = 'attendee'">
                <span class="role-icon">🎟️</span>
                <div>
                  <div class="role-title">Attend Events</div>
                  <div class="role-desc">Browse and purchase tickets</div>
                </div>
              </div>
              <div class="role-option" [class.selected]="role === 'organizer'" (click)="role = 'organizer'">
                <span class="role-icon">🎪</span>
                <div>
                  <div class="role-title">Organize Events</div>
                  <div class="role-desc">Create and manage events</div>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" style="width:100%" [disabled]="loading">
            @if (loading) {
              <span class="spinner" style="width:20px;height:20px;border-width:2px"></span>
            } @else {
              Create Account as {{ role === 'organizer' ? 'Organizer' : 'Attendee' }}
            }
          </button>
        </form>

        <p class="auth-footer">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .auth-card { width:100%; max-width:480px; padding:48px 40px; }
    .auth-header { text-align:center; margin-bottom:32px; }
    .auth-icon { font-size:3rem; display:block; margin-bottom:16px; }
    .auth-header h1 { font-size:1.8rem; margin-bottom:8px; }
    .auth-header p { color:var(--text-secondary); }
    .auth-form { margin-bottom:24px; }
    .auth-footer { text-align:center; color:var(--text-secondary); font-size:0.9rem; }

    .role-selector { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .role-option {
      display:flex; align-items:center; gap:12px;
      padding:16px; border-radius:var(--radius-md);
      border:2px solid var(--border-glass);
      cursor:pointer; transition:all 0.2s ease;
      background:var(--bg-card);
    }
    .role-option:hover { border-color:rgba(234,179,8,0.4); background:var(--bg-card-hover); }
    .role-option.selected {
      border-color:var(--accent-primary);
      background:rgba(234,179,8,0.1);
      box-shadow:0 0 0 1px var(--accent-primary);
    }
    .role-icon { font-size:1.8rem; flex-shrink:0; }
    .role-title { font-weight:600; font-size:0.9rem; margin-bottom:2px; }
    .role-desc { font-size:0.75rem; color:var(--text-muted); }
  `]
})
export class RegisterComponent {
  fullName = '';
  email = '';
  password = '';
  role = 'attendee';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) { }

  onSubmit() {
    this.loading = true;
    this.error = '';

    this.auth.register(this.email, this.password, this.fullName, this.role).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: () => {
        const dest = this.role === 'organizer' ? '/dashboard' : '/events';
        this.router.navigate([dest]);
      },
      error: (err) => {
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}
