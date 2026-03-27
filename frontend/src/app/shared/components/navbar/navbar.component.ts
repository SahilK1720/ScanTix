import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ScanTixFocusComponent } from '../scantix-focus/scantix-focus.component';
import { ShinyTextComponent } from '../shiny-text/shiny-text.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ScanTixFocusComponent, ShinyTextComponent],
  template: `
    <nav class="navbar">
      <div class="navbar-inner">
        @if (isScannerRoute()) {
          <div class="logo">
            <span class="logo-icon">🎟️</span>
            <span class="logo-text">
              <app-scantix-focus
                [blurAmount]="2"
                borderColor="#a78bfa"
                glowColor="rgba(167,139,250,0.55)"
                [animationDuration]="0.35"
                [pauseBetweenAnimations]="0.55"
              ></app-scantix-focus>
            </span>
          </div>
        } @else {
          <a routerLink="/" class="logo">
            <span class="logo-icon">🎟️</span>
            <span class="logo-text">
              <app-scantix-focus
                [blurAmount]="2"
                borderColor="#a78bfa"
                glowColor="rgba(167,139,250,0.55)"
                [animationDuration]="0.35"
                [pauseBetweenAnimations]="0.55"
              ></app-scantix-focus>
            </span>
          </a>
        }

        <div class="nav-links" [class.centered]="isScannerRoute()">
          @if (isScannerRoute()) {
            <span class="nav-scanner-text">
              <span class="scanner-icon">📷</span>
              <span class="scanner-label">Scanner</span>
            </span>
          } @else {
            <a routerLink="/events" routerLinkActive="active">Events</a>
            @if (auth.isAuthenticated) {
              @if (auth.isOrganizer) {
                <a routerLink="/my-events" routerLinkActive="active">My Events</a>
                <a routerLink="/events/create" routerLinkActive="active">+ Create</a>
                <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
                <a routerLink="/organizer/bank-details" routerLinkActive="active">🏦 Bank</a>
              } @else {
                <a routerLink="/my-tickets" routerLinkActive="active">My Tickets</a>
              }
              @if (auth.role === 'staff' || auth.role === 'scanner') {
                <a routerLink="/scanner" routerLinkActive="active">📷 Scanner</a>
              }
            }
          }
        </div>

        @if (!isScannerRoute()) {
          <div class="nav-actions">
            @if (auth.isAuthenticated) {
              <div class="user-badge" tabindex="0">
                <span class="user-avatar">{{ (auth.currentUser?.full_name || 'U')[0].toUpperCase() }}</span>
                <div class="user-info">
                  <span class="user-name">{{ auth.currentUser?.full_name }}</span>
                  <span class="user-role" [class]="'role-' + auth.role">
                    <app-shiny-text 
                      [text]="auth.role" 
                      [color]="auth.role === 'organizer' ? '#816804ff' : (auth.role === 'attendee' ? '#761ce3ff' : '#cbd5e1')" 
                      [shineColor]="auth.role === 'organizer' ? '#efe69eff' : (auth.role === 'attendee' ? '#bae6fd' : '#ffffff')" 
                      [speed]="auth.role === 'organizer' ? 3 : 5" 
                      [spread]="auth.role === 'organizer' ? 1.5 : 2.5">
                    </app-shiny-text>
                  </span>
                </div>
                <!-- Dropdown -->
                <div class="user-dropdown">
                  <div class="dropdown-item">
                    <span class="dropdown-label">Email ID</span>
                    <span class="dropdown-value">{{ auth.currentUser?.email }}</span>
                  </div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="auth.logout()">Logout</button>
            } @else {
              <a routerLink="/login" class="btn btn-secondary btn-sm">Login</a>
              <a routerLink="/register" class="btn btn-primary btn-sm">Sign Up</a>
            }
          </div>
        }

        <!-- Hamburger button (mobile only) -->
        @if (!isScannerRoute()) {
          <button class="hamburger-btn" (click)="toggleMenu()" [class.open]="menuOpen" aria-label="Toggle menu">
            <span></span><span></span><span></span>
          </button>
        }
      </div>

      <!-- Mobile Dropdown Menu -->
      @if (menuOpen && !isScannerRoute()) {
        <div class="mobile-menu" (click)="closeMenu()">
          <a routerLink="/events" routerLinkActive="active">🎪 Events</a>
          @if (auth.isAuthenticated) {
            @if (auth.isOrganizer) {
              <a routerLink="/my-events" routerLinkActive="active">📋 My Events</a>
              <a routerLink="/events/create" routerLinkActive="active">➕ Create Event</a>
              <a routerLink="/dashboard" routerLinkActive="active">📊 Dashboard</a>
              <a routerLink="/organizer/bank-details" routerLinkActive="active">🏦 Bank Details</a>
            } @else {
              <a routerLink="/my-tickets" routerLinkActive="active">🎟️ My Tickets</a>
            }
            @if (auth.role === 'staff' || auth.role === 'scanner') {
              <a routerLink="/scanner" routerLinkActive="active">📷 Scanner</a>
            }
            <div class="mobile-menu-divider"></div>
            <div class="mobile-user-row">
              <span class="user-avatar small">{{ (auth.currentUser?.full_name || 'U')[0].toUpperCase() }}</span>
              <div>
                <div class="mobile-user-name">{{ auth.currentUser?.full_name }}</div>
                <span class="user-role" [class]="'role-' + auth.role">{{ auth.role }}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm mobile-logout" (click)="$event.stopPropagation(); auth.logout()">Logout</button>
          } @else {
            <div class="mobile-menu-divider"></div>
            <a routerLink="/login" class="btn btn-secondary btn-sm mobile-auth-btn">Login</a>
            <a routerLink="/register" class="btn btn-primary btn-sm mobile-auth-btn">Sign Up</a>
          }
        </div>
      }
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
      position: relative;
    }
    .logo {
      display: flex; align-items: center; gap: 10px;
      font-family: 'Poppins', sans-serif; font-size: 1.4rem;
      font-weight: 700; text-decoration: none;
    }
    .logo-icon { font-size: 1.6rem; }
    .nav-links { display: flex; gap: 6px; }
    .nav-links.centered { position:absolute; left:50%; transform:translateX(-50%); }
    .nav-links a {
      padding: 8px 16px; border-radius: 12px;
      color: var(--text-secondary); font-size: 0.9rem;
      font-weight: 500; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-decoration: none;
      border: 1px solid transparent;
    }
    .nav-links a:hover, .nav-links a.active {
      color: var(--text-primary); 
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }
    .nav-actions { display: flex; align-items: center; gap: 12px; }
    .user-badge {
      display: flex; align-items: center; gap: 12px;
      padding: 6px 12px 6px 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px; transition: all 0.3s ease;
      position: relative; cursor: pointer;
    }
    .user-badge:hover, .user-badge:focus-within {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(168, 85, 247, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), var(--shadow-glow);
    }
    .user-dropdown {
      position: absolute; top: calc(100% + 12px); right: 0;
      width: max-content; min-width: 180px;
      background: rgba(10, 10, 26, 0.96);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px; padding: 14px 18px;
      opacity: 0; visibility: hidden; transform: translateY(-10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      z-index: 1000;
    }
    .user-badge:hover .user-dropdown, .user-badge:focus-within .user-dropdown {
      opacity: 1; visibility: visible; transform: translateY(0);
    }
    .dropdown-item { display: flex; flex-direction: column; gap: 6px; }
    .dropdown-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 800; }
    .dropdown-value { 
      font-size: 0.88rem; color: var(--text-primary); font-family: monospace; 
      background: rgba(255, 255, 255, 0.05); padding: 8px 12px; border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08); white-space: nowrap;
    }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--accent-gradient);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; font-weight: 700; color: white; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .user-avatar.small { width: 32px; height: 32px; font-size: 0.9rem; border-radius: 8px; }
    .user-info { display: flex; flex-direction: column; gap: 2px; }
    .user-name { font-size: 0.9rem; color: var(--text-primary); font-weight: 600; letter-spacing: -0.2px; }
    .user-role {
      font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.8px; padding: 2px 8px; border-radius: 20px;
      width: fit-content;
    }
    .role-organizer { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.2); }
    .role-admin { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
    .role-attendee { background: rgba(168, 85, 247, 0.15); color: #a78bfa; border: 1px solid rgba(168, 85, 247, 0.2); }
    .role-staff, .role-scanner { background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.2); }

    .nav-scanner-text {
      color: var(--accent-primary); font-weight: 700;
      letter-spacing: 1px; text-transform: uppercase;
      font-size: 1.1rem; display: flex; align-items: center; gap: 8px; line-height: 1;
    }
    .scanner-icon { font-size: 1.25rem; display: flex; align-items: center; justify-content: center; margin-top: -5px; }
    .scanner-label { display: flex; align-items: center; }

    /* Hamburger button */
    .hamburger-btn {
      display: none;
      flex-direction: column; justify-content: space-between;
      width: 28px; height: 20px;
      background: none; border: none; cursor: pointer; padding: 0;
    }
    .hamburger-btn span {
      display: block; width: 100%; height: 2px;
      background: var(--text-primary);
      border-radius: 2px;
      transition: all 0.25s ease;
      transform-origin: center;
    }
    .hamburger-btn.open span:nth-child(1) { transform: translateY(9px) rotate(45deg); }
    .hamburger-btn.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .hamburger-btn.open span:nth-child(3) { transform: translateY(-9px) rotate(-45deg); }

    /* Mobile dropdown */
    .mobile-menu {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 16px 20px;
      background: rgba(10, 10, 26, 0.97);
      border-top: 1px solid rgba(255,255,255,0.06);
      animation: slideDown 0.2s ease;
    }
    @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
    .mobile-menu a {
      padding: 13px 16px; border-radius: 10px;
      color: var(--text-secondary); font-size: 0.95rem;
      font-weight: 500; text-decoration: none; transition: all 0.2s ease;
      display: block;
    }
    .mobile-menu a:hover, .mobile-menu a.active {
      color: var(--text-primary); background: rgba(255,255,255,0.06);
    }
    .mobile-menu-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 8px 0; }
    .mobile-user-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      margin: 4px 0;
    }
    .mobile-user-name { font-size: 0.9rem; color: var(--text-primary); font-weight: 600; margin-bottom: 3px; }
    .mobile-logout {
      margin-top: 8px; width: 100%;
      display: flex; align-items: center; justify-content: center;
    }
    .mobile-auth-btn {
      text-align: center; margin-top: 6px; display: block;
    }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .nav-actions { display: none; }
      .hamburger-btn { display: flex; }
      .navbar-inner { padding: 0 16px; }
    }
  `]
})
export class NavbarComponent {
  menuOpen = false;

  constructor(
    public auth: AuthService,
    private router: Router
  ) { }

  isScannerRoute(): boolean {
    const url = this.router.url;
    return url.startsWith('/scanner') || url.startsWith('/scan');
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; }
}
