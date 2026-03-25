import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="navbar-inner">
        <a routerLink="/" class="logo">
          <span class="logo-icon">🎫</span>
          <span class="logo-text gradient-text">ScanTix</span>
        </a>

        <div class="nav-links">
          <a routerLink="/events" routerLinkActive="active">Events</a>
          @if (auth.isAuthenticated) {
            @if (auth.isOrganizer) {
              <a routerLink="/my-events" routerLinkActive="active">My Events</a>
              <a routerLink="/events/create" routerLinkActive="active">+ Create</a>
            } @else {
              <a routerLink="/my-tickets" routerLinkActive="active">My Tickets</a>
            }
            @if (auth.role === 'staff' || auth.role === 'scanner') {
              <a routerLink="/scanner" routerLinkActive="active">📷 Scanner</a>
            }
            <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          }
        </div>

        <div class="nav-actions">
          @if (auth.isAuthenticated) {
            <div class="user-badge">
              <span class="user-avatar">{{ (auth.currentUser?.full_name || 'U')[0].toUpperCase() }}</span>
              <div class="user-info">
                <span class="user-name">{{ auth.currentUser?.full_name }}</span>
                <span class="user-role" [class]="'role-' + auth.role">{{ auth.role }}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" (click)="auth.logout()">Logout</button>
          } @else {
            <a routerLink="/login" class="btn btn-secondary btn-sm">Login</a>
            <a routerLink="/register" class="btn btn-primary btn-sm">Sign Up</a>
          }
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: sticky; top: 0; z-index: 100;
      background: rgba(10, 10, 26, 0.9);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .navbar-inner {
      max-width: 1400px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; height: 64px;
    }
    .logo {
      display: flex; align-items: center; gap: 10px;
      font-family: 'Outfit', sans-serif; font-size: 1.4rem;
      font-weight: 700; text-decoration: none;
    }
    .logo-icon { font-size: 1.6rem; }
    .nav-links { display: flex; gap: 4px; }
    .nav-links a {
      padding: 8px 14px; border-radius: 8px;
      color: var(--text-secondary); font-size: 0.88rem;
      font-weight: 500; transition: all 0.2s ease; text-decoration: none;
    }
    .nav-links a:hover, .nav-links a.active {
      color: var(--text-primary); background: rgba(255, 255, 255, 0.06);
    }
    .nav-actions { display: flex; align-items: center; gap: 12px; }
    .user-badge { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--accent-gradient);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem; font-weight: 700; color: white; flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; }
    .user-name { font-size: 0.88rem; color: var(--text-primary); font-weight: 500; }
    .user-role {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; padding: 1px 6px; border-radius: 4px;
    }
    .role-organizer { background: rgba(234,179,8,0.2); color: #facc15; }
    .role-admin { background: rgba(239,68,68,0.2); color: #f87171; }
    .role-attendee { background: rgba(16,185,129,0.2); color: #34d399; }
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .user-info { display: none; }
    }
  `]
})
export class NavbarComponent {
  constructor(public auth: AuthService) { }
}
