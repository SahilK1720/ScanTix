import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeatMapComponent } from '../../../shared/seat-map/seat-map.component';
import { EventSeat, SeatService } from '../../../core/services/seat.service';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { PaymentModalComponent, PaymentDetails } from '../../../shared/payment-modal/payment-modal.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SeatMapComponent, PaymentModalComponent],
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
              <span class="badge" [class]="event.refund_policy === 'REFUNDABLE' ? 'badge-success' : 'badge-danger'" style="margin-left:8px">
                {{ event.refund_policy === 'REFUNDABLE' ? 'Refundable Event' : 'Non-Refundable Event' }}
              </span>
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
                <div class="detail-value">
                  {{ event.event_date | date:'EEEE, MMMM d, y' }}<br>
                  <span style="color:var(--accent-primary)">{{ event.event_date | date:'h:mm a' }} IST</span>
                </div>
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

          <div class="glass-card" style="padding:18px;margin-top:20px;background:rgba(255,255,255,0.03)">
            @if (event.refund_policy === 'NON_REFUNDABLE') {
              <p style="margin:0 0 8px;color:#fca5a5;font-weight:600">Non-Refundable Event</p>
              <p style="margin:0;color:var(--text-secondary)">
                Once a ticket is purchased, the attendee will not receive any refund if they cancel.
              </p>
            } @else {
              <p style="margin:0 0 8px;color:#86efac;font-weight:600">Refundable Event</p>
              <p style="margin:0;color:var(--text-secondary)">
                If the attendee cancels their ticket, they will receive a refund excluding the convenience fee.
              </p>
              <p style="margin:10px 0 0;color:var(--text-muted)">
                Refunds are allowed only if the ticket is cancelled at least 24 hours before the event start time.
                If cancelled within 24 hours of the event start time, no refund will be issued.
              </p>
            }
          </div>

          <!-- ── Purchase / Seat Section ──────────────────────────────────────── -->
          @if (event.status !== 'cancelled' && auth.isAuthenticated) {
            <div class="glass-card" style="padding:24px;margin-top:32px;background:rgba(234,179,8,0.05);border-color:rgba(234,179,8,0.2)">
              @if (auth.isOrganizer) {
                <div class="restriction-banner" style="padding:16px;margin-bottom:24px;border-radius:8px;font-size:0.9rem">
                  ℹ️ <strong>Organizer View:</strong> You can see the live seat availability, but seat selection and ticket purchases are disabled for organizer accounts.
                </div>
              }

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
                  [readOnly]="auth.isOrganizer"
                  (selectionChanged)="onSeatSelectionChanged($event)"
                ></app-seat-map>

                @if (selectedSeats.length > 0 && !auth.isOrganizer) {
                  <div class="purchase-summary" style="margin-top:20px">
                    <div class="fee-row">
                      <span>Subtotal ({{ selectedSeats.length }} seat{{ selectedSeats.length > 1 ? 's' : '' }})</span>
                      <span>&#8377;{{ getSubtotal() | number:'1.0-0' }}</span>
                    </div>
                    <div class="fee-row" style="color:var(--text-muted);font-size:0.85rem">
                      <span>Convenience Fee (2%)</span>
                      <span>&#8377;{{ getConvenienceFee() | number:'1.2-2' }}</span>
                    </div>
                    <div class="fee-row fee-total">
                      <span>Total</span>
                      <strong style="color:var(--accent-primary);font-size:1.25rem">&#8377;{{ getTotalAmount() | number:'1.2-2' }}</strong>
                    </div>
                    <button class="btn btn-primary" style="margin-top:12px;width:100%" (click)="proceedToPayment()" [disabled]="lockingSeats">
                      @if (lockingSeats) {
                        <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                        Locking seats...
                      } @else {
                        Proceed to Payment
                      }
                    </button>
                    @if (purchaseError) { <div class="alert alert-danger" style="margin-top:8px">{{ purchaseError }}</div> }
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
                  
            @if (!auth.isOrganizer) {
                    <button class="btn btn-primary" (click)="proceedToPaymentStandard()" [disabled]="lockingSeats">
                      @if (lockingSeats) {
                        <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                        Processing...
                      } @else { 💳 Proceed to Payment }
                    </button>
                  }
                }
              </div>
            } @else if (!auth.isAuthenticated) {
              <div style="margin-top:32px;text-align:center">
                <a routerLink="/login" class="btn btn-primary btn-lg">Login to Purchase Tickets</a>
              </div>
            }

          <!-- ── Manage Staff (Organizer Only) ────────────────────────────── -->
          @if (event.organizer_id === auth.currentUser?.id) {
            <div class="glass-card" style="padding:24px;margin-top:32px;border-color:rgba(16,185,129,0.2)">
              <h3 style="margin-bottom:8px">💂 Manage Staff</h3>
              <p style="color:var(--text-secondary);font-size:0.9rem">
                Staff management has moved to the event analytics page.
              </p>
              <a [routerLink]="['/analytics', event.id]" class="btn btn-secondary" style="margin-top:12px">
                Go to Analytics & Staff Management →
              </a>
            </div>
          }
        </div>
      }
    </div>

    <!-- Payment Modal -->
    @if (showPaymentModal && paymentDetails) {
      <app-payment-modal
        [payment]="paymentDetails"
        (confirmed)="onPaymentConfirmed()"
        (cancelled)="onPaymentCancelled()"
      ></app-payment-modal>
    }
  `,
  styles: [`
    .price-tag { text-align:right; padding:16px 24px; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-glass); }
    .price-label { font-size:.75rem; color:var(--text-muted); text-transform:uppercase; }
    .price-value { font-size:1.8rem; font-weight:700; font-family:'Outfit',sans-serif; background:var(--accent-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:20px; }
    .detail-item { display:flex; gap:12px; align-items:center; padding:16px; background:var(--bg-card); border-radius:var(--radius-md); }
    .detail-label { font-size:.8rem; color:var(--text-muted); margin-bottom:4px; }
    .detail-value { font-weight:600; }
    .restriction-banner {
      background: rgba(59, 130, 246, 0.05);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }
    .purchase-summary {
      background: rgba(234,179,8,0.06);
      border: 1px solid rgba(234,179,8,0.2);
      border-radius: 12px;
      padding: 16px;
    }
    .fee-row {
      display: flex; justify-content: space-between;
      padding: 6px 0; font-size: 0.9rem; color: var(--text-secondary);
    }
    .fee-total {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 10px; margin-top: 4px;
      font-size: 1rem; color: var(--text-primary);
    }
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

  // Payment flow
  lockingSeats = false;
  showPaymentModal = false;
  paymentDetails: PaymentDetails | null = null;
  lockedSeatIds: string[] = [];
  lockedUntil = '';
  purchasing = false;
  purchaseSuccess = '';
  purchaseError = '';

  // Staff management (fields kept for template compatibility)
  staffEmail = '';
  assigningStaff = false;
  staffSuccess = '';
  staffError = '';  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private ticketService: TicketService,
    private seatService: SeatService,
    public auth: AuthService,
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
    this.purchaseError = '';
    this.cdr.detectChanges();
  }

  getSubtotal(): number {
    if (!this.event) return 0;
    return this.selectedSeats.reduce((sum, seat) => {
      const isVip = seat.row_label === 'A' || seat.row_label === 'B';
      const price = isVip ? (this.event?.vip_price || this.event!.ticket_price) : this.event!.ticket_price;
      return sum + Number(price);
    }, 0);
  }

  getConvenienceFee(): number {
    return this.getSubtotal() * 0.02;
  }

  getTotalAmount(): number {
    return this.getSubtotal() + this.getConvenienceFee();
  }

  // ── SEAT MAP FLOW ──────────────────────────────────────────────────────────

  proceedToPayment() {
    if (!this.event || this.selectedSeats.length === 0) return;
    this.lockingSeats = true;
    this.purchaseError = '';
    this.cdr.detectChanges();

    this.seatService.lockSeats(this.event.id, this.selectedSeats.map(s => s.id)).subscribe({
      next: (resp) => {
        this.lockingSeats = false;
        this.lockedSeatIds = resp.seats.map(s => s.id);
        this.lockedUntil = resp.locked_until;
        this.paymentDetails = {
          baseAmount: this.getSubtotal(),
          convenienceFee: this.getConvenienceFee(),
          totalAmount: this.getTotalAmount(),
          seats: this.selectedSeats,
          event: this.event!,
          lockedUntil: resp.locked_until
        };
        this.showPaymentModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.lockingSeats = false;
        this.purchaseError = err.error?.message || 'Could not lock selected seats. Another user may have taken them.';
        this.cdr.detectChanges();
      }
    });
  }

  onPaymentConfirmed() {
    this.showPaymentModal = false;
    this.purchaseSuccess = `🎉 Payment successful! Redirecting to your tickets...`;
    
    if (this.event) {
      this.event.tickets_sold += this.selectedSeats.length || this.quantity;
    }
    
    this.selectedSeats = [];
    this.lockedSeatIds = [];
    this.cdr.detectChanges();

    setTimeout(() => {
      this.router.navigate(['/my-tickets']);
    }, 1500);
  }

  onPaymentCancelled() {
    if (!this.event || this.lockedSeatIds.length === 0) {
      this.showPaymentModal = false;
      this.paymentDetails = null;
      this.cdr.detectChanges();
      return;
    }

    this.seatService.unlockSeats(this.event.id, this.lockedSeatIds).subscribe();
    this.lockedSeatIds = [];
    this.showPaymentModal = false;
    this.paymentDetails = null;
    this.selectedSeats = [];
    this.cdr.detectChanges();
  }

  // ── STANDARD (NO SEAT-MAP) FLOW ────────────────────────────────────────────

  proceedToPaymentStandard() {
    if (!this.event) return;
    const subtotal = this.quantity * Number(this.event.ticket_price);
    const fee = subtotal * 0.02;
    const total = subtotal + fee;

    this.paymentDetails = {
      baseAmount: subtotal,
      convenienceFee: fee,
      totalAmount: total,
      seats: [],
      event: this.event,
      lockedUntil: new Date(Date.now() + 8 * 60 * 1000).toISOString()
    };
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  calculateTotal(): number {
    if (!this.event) return 0;
    if (this.event.seat_map_enabled && this.selectedSeats.length > 0) {
      return this.getSubtotal();
    }
    return this.quantity * Number(this.event.ticket_price);
  }

  purchase() {
    // Fallback if called directly
    this.proceedToPaymentStandard();
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
