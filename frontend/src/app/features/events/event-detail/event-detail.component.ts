import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeatMapComponent } from '../../../shared/seat-map/seat-map.component';
import { EventSeat } from '../../../core/services/seat.service';
import { StaffService } from '../../../core/services/staff.service';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SeatMapComponent],
  template: `
    <div class="page-container animate-fadeIn">
      @if (loading) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading event...</span></div>
      } @else if (event) {
        <a routerLink="/events" style="color:var(--text-secondary);margin-bottom:16px;display:inline-block">
          ← Back to Events
        </a>

        @if (event.image_urls && event.image_urls.length > 0) {
          <!-- Carousel or gallery view for multiple images -->
          <div style="margin-top:8px; display:flex; gap:16px; overflow-x:auto; padding-bottom:16px; scroll-snap-type: x mandatory">
            @for (img of event.image_urls; track img; let i = $index) {
              <div class="event-banner animate-fadeIn" 
                   [style]="getSafeStyle(img)"
                   style="min-width:100%; height:450px; background-size:cover; background-position:center; border-radius:16px; border:1px solid rgba(255,255,255,0.05); scroll-snap-align: center">
              </div>
            }
          </div>
          @if (event.image_urls.length > 1) {
            <p style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:-8px; margin-bottom:16px">
              ← Swipe to see more ({{ event.image_urls.length }} photos) →
            </p>
          }
        }

        <div class="glass-card" style="padding:40px;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px;flex-wrap:wrap;gap:16px">
            <div>
              <h1 style="font-size:2rem;margin-bottom:8px">{{ event.title }}</h1>
              <span class="badge" [class]="getStatusClass(event.status)">{{ event.status }}</span>
              @if (event.seat_map_enabled) {
                <span class="badge badge-info" style="margin-left:8px">🪑 Seat Selection</span>
              }
            </div>
            <div class="price-tag">
              <div class="price-label">Starting at</div>
              <div class="price-value">&#8377;{{ event.ticket_price }}</div>
            </div>
          </div>

          @if (event.description) {
            <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:24px">
              {{ event.description }}
            </p>
          }

          <div class="detail-grid">
            <div class="detail-item">
              <span>📅</span>
              <div>
                <div class="detail-label">Date & Time</div>
                <div class="detail-value">{{ event.event_date | date:'full' }}</div>
              </div>
            </div>
            @if (event.location) {
              <div class="detail-item">
                <span>📍</span>
                <div>
                  <div class="detail-label">Location</div>
                  <div class="detail-value">{{ event.location }}</div>
                </div>
              </div>
            }
            <div class="detail-item">
              <span>🎟️</span>
              <div>
                <div class="detail-label">Tickets Available</div>
                <div class="detail-value">{{ event.max_tickets - event.tickets_sold }} of {{ event.max_tickets }}</div>
              </div>
            </div>
            @if (event.vip_price) {
              <div class="detail-item">
                <span>⭐</span>
                <div>
                  <div class="detail-label">VIP Price</div>
                  <div class="detail-value">&#8377;{{ event.vip_price }}</div>
                </div>
              </div>
            }
            @if (event.seat_map_enabled && event.seat_rows && event.seat_columns) {
              <div class="detail-item">
                <span>🪑</span>
                <div>
                  <div class="detail-label">Seat Layout</div>
                  <div class="detail-value">{{ event.seat_rows }} rows × {{ event.seat_columns }} seats</div>
                </div>
              </div>
            }
          </div>

          <!-- ── Purchase / Seat Section ──────────────────────────────────────── -->
          @if (event.status !== 'cancelled' && auth.isAuthenticated) {
            <div class="glass-card" style="padding:24px;margin-top:32px;background:rgba(234,179,8,0.05);border-color:rgba(234,179,8,0.2)">

              @if (event.seat_map_enabled) {
                <!-- SEAT MAP MODE -->
                <h3 style="margin-bottom:8px">🪑 Select Your Seats</h3>
                <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:20px">
                  Click an available seat to lock it for 10 minutes. Then click "Buy Now" to confirm.
                </p>

                @if (purchaseSuccess) { <div class="alert alert-success">{{ purchaseSuccess }}</div> }
                @if (purchaseError) { <div class="alert alert-danger">{{ purchaseError }}</div> }

                <app-seat-map
                  [eventId]="event.id"
                  [currentUserId]="auth.currentUser?.id ?? null"
                  [layoutType]="event.seat_layout"
                  (selectionChanged)="onSeatSelectionChanged($event)"
                ></app-seat-map>

                @if (selectedSeats.length > 0) {
                  <div style="display:flex;align-items:center;gap:16px;margin-top:20px;flex-wrap:wrap">
                    <div>
                      <p style="color:var(--text-secondary);font-size:.9rem;margin:0">
                        Total: <strong style="color:var(--text-primary);font-size:1.2rem">
                          &#8377;{{ calculateTotal().toFixed(2) }}
                        </strong>
                        ({{ selectedSeats.length }} seat{{ selectedSeats.length > 1 ? 's' : '' }})
                      </p>
                    </div>
                    <button class="btn btn-primary" (click)="purchaseSeats()" [disabled]="purchasing">
                      @if (purchasing) {
                        <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                      } @else { 🎟️ Buy Now }
                    </button>
                  </div>
                }

              } @else {
                <!-- STANDARD QUANTITY MODE -->
                <h3 style="margin-bottom:16px">🎟️ Purchase Tickets</h3>

                @if (purchaseSuccess) { <div class="alert alert-success">{{ purchaseSuccess }}</div> }
                @if (purchaseError) { <div class="alert alert-danger">{{ purchaseError }}</div> }

                <div style="display:flex;gap:12px;margin-bottom:16px">
                  <div class="form-group" style="flex:1">
                    <label>Quantity</label>
                    <select class="form-control" [(ngModel)]="quantity">
                      @for (n of [1,2,3,4,5,6,7,8,9,10]; track n) {
                        <option [ngValue]="n">{{ n }} Ticket{{ n > 1 ? 's' : '' }}</option>
                      }
                    </select>
                  </div>

                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:12px;background:rgba(234,179,8,0.1);border-radius:8px">
                  <span style="color:var(--text-secondary)">Total Amount</span>
                  <span style="font-size:1.4rem;font-weight:700;color:var(--accent-primary)">
                    {{ calculateTotal() | currency:'INR' }}
                  </span>
                </div>
                  <button class="btn btn-primary" (click)="purchase()" [disabled]="purchasing">
                    @if (purchasing) {
                      <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                    } @else { Buy Now }
                  </button>
              }

            </div>
          } @else if (!auth.isAuthenticated) {
            <div style="margin-top:32px;text-align:center">
              <a routerLink="/login" class="btn btn-primary btn-lg">Login to Purchase Tickets</a>
            </div>
          }

          <!-- ── Manager Staff Selection (Organizer Only) ────────────────────── -->
          @if (event.organizer_id === auth.currentUser?.id) {
            <div class="glass-card" style="padding:24px;margin-top:32px;border-color:rgba(16,185,129,0.2)">
              <h3 style="margin-bottom:16px">💂 Manage Staff</h3>
              <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">
                Assign a staff member by email to allow them to scan tickets for this event.
              </p>
              
              <div style="display:flex;gap:12px">
                <div class="form-group" style="flex:1;margin-bottom:0">
                  <input type="email" class="form-control" [(ngModel)]="staffEmail" placeholder="Enter staff email...">
                </div>
                <button class="btn btn-primary" (click)="assignStaff()" [disabled]="!staffEmail || assigningStaff">
                  @if (assigningStaff) {
                    <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                  } @else { Assign Staff }
                </button>
              </div>

              @if (staffSuccess) { <div class="alert alert-success" style="margin-top:16px">{{ staffSuccess }}</div> }
              @if (staffError) { <div class="alert alert-danger" style="margin-top:16px">{{ staffError }}</div> }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .price-tag { text-align:right; padding:16px 24px; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-glass); }
    .price-label { font-size:.75rem; color:var(--text-muted); text-transform:uppercase; }
    .price-value { font-size:1.8rem; font-weight:700; font-family:'Outfit',sans-serif; background:var(--accent-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:20px; }
    .detail-item { display:flex; gap:12px; align-items:center; padding:16px; background:var(--bg-card); border-radius:var(--radius-md); }
    .detail-label { font-size:.8rem; color:var(--text-muted); margin-bottom:4px; }
    .detail-value { font-weight:600; }
  `]
})
export class EventDetailComponent implements OnInit, OnDestroy {
  event: ScanEvent | null = null;
  loading = true;

  // Standard mode
  quantity = 1;
  ticketType: 'standard' | 'vip' = 'standard';
  ticketQtyOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Seat mode
  selectedSeats: EventSeat[] = [];

  purchasing = false;
  purchaseSuccess = '';
  purchaseError = '';

  // Staff management
  staffEmail = '';
  assigningStaff = false;
  staffSuccess = '';
  staffError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private ticketService: TicketService,
    public auth: AuthService,
    private staffService: StaffService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.eventService.getEvent(id).subscribe({
      next: (event) => {
        this.event = event;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() { }

  onSeatSelectionChanged(seats: EventSeat[]) {
    this.selectedSeats = seats;
    this.cdr.detectChanges();
  }

  purchaseSeats() {
    if (!this.event || this.selectedSeats.length === 0) return;
    this.purchasing = true;
    this.purchaseError = '';
    this.purchaseSuccess = '';
    this.cdr.detectChanges();

    this.ticketService.purchaseTickets({
      event_id: this.event.id,
      quantity: this.selectedSeats.length,
      seat_ids: this.selectedSeats.map(s => s.id)
    }).subscribe({
      next: (tickets) => {
        this.purchasing = false;
        this.purchaseSuccess = `🎉 Successfully booked ${tickets.length} seat(s)! Redirecting to your tickets...`;
        if (this.event) this.event.tickets_sold += tickets.length;
        this.selectedSeats = [];
        this.cdr.detectChanges();
        setTimeout(() => {
          if (tickets.length > 0) {
            this.router.navigate(['/my-tickets'], { queryParams: { id: tickets[0].id } });
          } else {
             this.router.navigate(['/my-tickets']);
          }
        }, 1500);
      },
      error: (err) => {
        this.purchasing = false;
        this.purchaseError = err.error?.message || 'Purchase failed. Please re-select your seats and try again.';
        this.cdr.detectChanges();
      }
    });
  }

  assignStaff() {
    if (!this.event || !this.staffEmail) return;

    this.assigningStaff = true;
    this.staffError = '';
    this.staffSuccess = '';

    this.staffService.assignStaff(this.event.id, this.staffEmail).subscribe({
      next: () => {
        this.assigningStaff = false;
        this.staffSuccess = 'Staff assigned successfully!';
        this.staffEmail = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assigningStaff = false;
        this.staffError = err.error?.message || 'Failed to assign staff';
        this.cdr.detectChanges();
      }
    });
  }

  calculateTotal(): number {
    if (!this.event) return 0;
    
    // Seat-map mode (Dynamic based on row)
    if (this.event.seat_map_enabled && this.selectedSeats.length > 0) {
      return this.selectedSeats.reduce((sum, seat) => {
        const isVip = seat.row_label === 'A' || seat.row_label === 'B';
        const price = isVip ? (this.event?.vip_price || this.event!.ticket_price) : this.event!.ticket_price;
        return sum + Number(price);
      }, 0);
    }

    // Standard mode (Always standard as requested)
    return this.quantity * Number(this.event.ticket_price);
  }

  purchase() {
    if (!this.event) return;
    this.purchasing = true;
    this.purchaseError = '';
    this.purchaseSuccess = '';
    this.cdr.detectChanges();

    this.ticketService.purchaseTickets({ 
      event_id: this.event.id, 
      quantity: Number(this.quantity),
      ticket_type: this.ticketType
    }).subscribe({
      next: (tickets) => {
        this.purchasing = false;
        this.purchaseSuccess = `Successfully purchased ${tickets.length} ticket(s)! Redirecting to your tickets...`;
        if (this.event) this.event.tickets_sold += tickets.length;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (tickets.length > 0) {
            this.router.navigate(['/my-tickets'], { queryParams: { id: tickets[0].id } });
          } else {
             this.router.navigate(['/my-tickets']);
          }
        }, 1500);
      },
      error: (err) => {
        this.purchasing = false;
        this.purchaseError = err.error?.message || 'Purchase failed. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  getStatusClass(status: string): string {
    return status === 'published' ? 'badge-success' : status === 'draft' ? 'badge-warning' : status === 'cancelled' ? 'badge-danger' : 'badge-info';
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
