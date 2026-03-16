import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService, LocationSuggestion } from '../../../core/services/location.service';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div>
          <h1>🎪 <span class="gradient-text">Discover Events</span></h1>
          <p>Find and book tickets for amazing experiences</p>
        </div>
        @if (auth.isOrganizer) {
          <a routerLink="/events/create" class="btn btn-primary">➕ Create Event</a>
        }
      </div>

      <!-- Search and Location Bar -->
      <div class="search-bar glass-card" style="padding:16px;margin-bottom:24px;display:flex;gap:12px">
        <button class="btn btn-secondary" style="white-space:nowrap;display:flex;align-items:center;gap:8px" (click)="showCityModal = true">
          <span>📍</span> {{ selectedCity || 'All Cities' }}
        </button>
        <input class="form-control" [(ngModel)]="searchTerm" (ngModelChange)="filterEvents()"
               placeholder="🔍 Search events by title or location..." style="background:transparent;border:none;box-shadow:none;font-size:1rem;flex:1">
      </div>

      <!-- City Selection Modal -->
      @if (showCityModal) {
        <div class="modal-backdrop" (click)="showCityModal = false">
          <div class="modal-card glass-card" (click)="$event.stopPropagation()" style="width:100%;max-width:800px;padding:32px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
              <h2 style="margin:0">Select your city</h2>
              <button class="btn btn-icon" (click)="showCityModal = false" style="background:transparent;border:none;color:inherit;font-size:1.5rem;cursor:pointer">✕</button>
            </div>
            
            <input class="form-control" [(ngModel)]="citySearchTerm" 
                   (ngModelChange)="onCitySearchInput($event)"
                   placeholder="🔍 Search for your city" style="margin-bottom:32px;background:rgba(255,255,255,0.05)">
            
            @if (isSearchingCities) {
              <div style="text-align:center;margin-bottom:16px"><div class="spinner-small"></div> Searching...</div>
            }

            @if (citySuggestions.length > 0) {
              <div class="city-suggestions-list" style="margin-bottom:24px">
                @for (sugg of citySuggestions; track sugg.displayName) {
                  <div class="city-suggestion-item" (click)="selectCity(sugg.city || sugg.displayName)">
                    <span class="suggestion-icon">📍</span>
                    <div class="suggestion-text">
                      <div class="s-name">{{ sugg.city || sugg.displayName }}</div>
                      <div class="s-detail">{{ sugg.displayName }}</div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div style="text-align:center;margin-bottom:16px;color:var(--text-secondary);font-size:0.9rem">
                {{ citySearchTerm ? 'No exact matches found. Try popular cities:' : 'Popular Cities' }}
              </div>
              
              <div class="city-grid">
                <!-- "All Cities" Option -->
                <div class="city-option" (click)="selectCity('')" [class.active]="!selectedCity">
                  <span style="font-size:2rem;display:block;margin-bottom:8px">🌍</span>
                  <span>All Cities</span>
                </div>
                @for (city of popularCities; track city.name) {
                  <!-- Hide cities that don't match the search term -->
                  @if (!citySearchTerm || city.name.toLowerCase().includes(citySearchTerm.toLowerCase())) {
                    <div class="city-option" (click)="selectCity(city.name)" [class.active]="selectedCity === city.name">
                      <span style="font-size:2rem;display:block;margin-bottom:8px">{{ city.icon }}</span>
                      <span>{{ city.name }}</span>
                    </div>
                  }
                }
              </div>
            }
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading-overlay">
          <div class="spinner"></div>
          <span>Loading events...</span>
        </div>
      } @else if (errorMsg) {
        <div class="alert alert-danger" style="margin-bottom:16px">{{ errorMsg }}</div>
        <button class="btn btn-secondary" (click)="loadEvents()">Retry</button>
      } @else if (filtered.length === 0) {
        <div class="glass-card" style="padding:60px;text-align:center">
          <span style="font-size:4rem;display:block;margin-bottom:16px">🎭</span>
          <h2>{{ searchTerm ? 'No events match your search' : 'No events yet' }}</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">
            {{ searchTerm ? 'Try a different search term' : 'Check back soon!' }}
          </p>
          @if (searchTerm) {
            <button class="btn btn-secondary" (click)="searchTerm=''; filterEvents()">Clear Search</button>
          }
        </div>
      } @else {
        <div class="grid-2">
          @for (event of filtered; track event.id) {
            <a [routerLink]="['/events', event.id]" class="event-card glass-card" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;overflow:hidden">
              @if (event.image_urls && event.image_urls.length > 0) {
                <div [style]="getSafeStyle(event.image_urls[0])"
                     style="height:240px;width:100%;background-size:cover;background-position:center;border-bottom:1px solid rgba(255,255,255,0.08)">
                </div>
              }
              <div class="event-card-body">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                  <h3 style="font-size:1.15rem;font-family:'Outfit',sans-serif;line-height:1.3">{{ event.title }}</h3>
                </div>

                @if (event.location) {
                  <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">📍 {{ event.location }}</p>
                }

                @if (event.description) {
                  <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:16px;line-height:1.5">
                    {{ truncate(event.description) }}
                  </p>
                }

                <div class="event-meta">
                  <div class="meta-item">📅 {{ event.event_date | date:'EEEE, MMM d, y' }} • {{ event.event_date | date:'h:mm a' }} IST</div>
                  <div class="meta-item">💰 &#8377;{{ event.ticket_price }}</div>
                  <div class="meta-item">🎟️ {{ event.max_tickets - event.tickets_sold }} left</div>
                </div>

                <div class="progress-bar" style="margin-top:16px">
                  <div class="progress-fill" [style.width.%]="getSoldPct(event)"></div>
                </div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">
                  {{ event.tickets_sold }}/{{ event.max_tickets }} tickets sold
                </p>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .search-bar input:focus { outline: none; }
    .event-card-body { padding: 24px; }
    .event-meta { display:flex; flex-wrap:wrap; gap:12px; }
    .meta-item { font-size:0.82rem; color:var(--text-secondary); }
    .progress-bar { height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
    .progress-fill { height:100%; background:var(--accent-gradient); border-radius:2px; transition:width 0.5s ease; }
    
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding-top:100px; padding-left:24px; padding-right:24px; padding-bottom:24px; }
    .city-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:16px; text-align:center; }
    .city-option { cursor:pointer; padding:16px 8px; border-radius:12px; transition:all 0.2s; border:1px solid transparent; }
    .city-option:hover { background:rgba(255,255,255,0.05); transform:translateY(-2px); }
    .city-option.active { border-color:var(--primary); background:rgba(234,179,8,0.05); color:var(--primary); }

    .city-suggestions-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 8px;
    }
    .city-suggestion-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .city-suggestion-item:hover {
      background: rgba(255,255,255,0.08);
      border-color: var(--primary);
    }
    .suggestion-icon { font-size: 1.2rem; }
    .suggestion-text { display: flex; flex-direction: column; gap: 2px; }
    .s-name { font-weight: 600; color: var(--text-primary); }
    .s-detail { font-size: 0.75rem; color: var(--text-muted); }

    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
  `]
})
export class EventListComponent implements OnInit {
  events: ScanEvent[] = [];
  filtered: ScanEvent[] = [];
  searchTerm = '';
  loading = true;
  errorMsg = '';

  // Location Filter State
  showCityModal = false;
  selectedCity = '';
  citySearchTerm = '';
  popularCities = [
    { name: 'Mumbai', icon: '🏙️' },
    { name: 'Delhi-NCR', icon: '🏛️' },
    { name: 'Bengaluru', icon: '💻' },
    { name: 'Hyderabad', icon: '🕌' },
    { name: 'Chandigarh', icon: '🌆' },
    { name: 'Ahmedabad', icon: '🌉' },
    { name: 'Pune', icon: '🏰' },
    { name: 'Chennai', icon: '🌊' },
    { name: 'Kolkata', icon: '🚊' }
  ];

  constructor(
    private eventService: EventService,
    private locationService: LocationService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  // City Search State
  private citySearch$ = new Subject<string>();
  citySuggestions: LocationSuggestion[] = [];
  isSearchingCities = false;

  ngOnInit() {
    this.loadEvents();

    // Setup city search logic
    this.citySearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.citySuggestions = [];
          return of([]);
        }
        this.isSearchingCities = true;
        this.cdr.detectChanges();
        return this.locationService.searchCities(query).pipe(
          finalize(() => {
            this.isSearchingCities = false;
            this.cdr.detectChanges();
          })
        );
      })
    ).subscribe(suggestions => {
      this.citySuggestions = suggestions;
      this.cdr.detectChanges();
    });
  }

  loadEvents() {
    this.loading = true;
    this.errorMsg = '';
    this.eventService.getEvents().pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (events) => {
        this.events = events;
        this.filtered = events;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err.error?.message || `Failed to load events (${err.status || 'network error'})`;
        this.cdr.detectChanges();
      }
    });
  }

  filterEvents() {
    const term = this.searchTerm.toLowerCase();
    
    this.filtered = this.events.filter(e => {
      // 1. Filter by location (City dropdown)
      if (this.selectedCity) {
        if (!e.location || !e.location.toLowerCase().includes(this.selectedCity.toLowerCase())) {
          return false;
        }
      }
      
      // 2. Filter by Search Query (Title/Location description)
      if (!term) return true;
      
      return e.title.toLowerCase().includes(term) ||
             (e.location?.toLowerCase().includes(term) ?? false) ||
             (e.description?.toLowerCase().includes(term) ?? false);
    });
  }

  onCitySearchInput(query: string) {
    this.citySearch$.next(query);
  }

  selectCity(cityName: string) {
    this.selectedCity = cityName;
    this.showCityModal = false;
    this.citySearchTerm = '';
    this.citySuggestions = [];
    this.filterEvents();
  }

  truncate(text: string): string {
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  }

  getSoldPct(event: ScanEvent): number {
    if (!event.max_tickets) return 0;
    return (event.tickets_sold / event.max_tickets) * 100;
  }

  getStatusClass(s: string) {
    return s === 'published' ? 'badge-success' : s === 'draft' ? 'badge-warning' : s === 'cancelled' ? 'badge-danger' : 'badge-info';
  }

  getImageUrl(path: string): string {
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path}`;
  }

  getSafeStyle(path: string): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(`background-image: url('${this.getImageUrl(path)}')`);
  }
}
