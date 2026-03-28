import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService, ScanEvent } from '../../../core/services/event.service';
import { TicketService } from '../../../core/services/ticket.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeatMapComponent } from '../../../shared/seat-map/seat-map.component';
import { EventSeat, SeatService } from '../../../core/services/seat.service';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { PaymentModalComponent, PaymentDetails } from '../../../shared/payment-modal/payment-modal.component';
import { ShinyTextComponent } from '../../../shared/components/shiny-text/shiny-text.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SeatMapComponent, PaymentModalComponent, ShinyTextComponent],
  template: `
    <div class="page-container animate-fadeIn">
      @if (loading) {
        <div class="loading-overlay"><div class="spinner"></div><span>Loading event...</span></div>
      } @else if (event) {
        <a routerLink="/events" style="color:var(--text-secondary);margin-bottom:16px;display:inline-block">
          ← Back to Events
        </a>

        @if (event.image_urls && event.image_urls.length > 0) {
          <!-- ── 3D Animated Image Carousel ───────────────────────────────── -->
          @if (event.image_urls.length === 1) {
            <!-- Single image: static display, no carousel -->
            <div class="static-banner animate-fadeIn">
              <div [style]="getSafeStyle(event.image_urls[0])" class="static-banner-bg"></div>
              <div [style]="getSafeStyle(event.image_urls[0])" class="static-banner-fg"></div>
            </div>
          } @else {
            <!-- Multi-image: 3D perspective carousel -->
            <div class="carousel-wrapper">
              <!-- Soft ambient gradient background -->
              <div class="carousel-bg-gradient"></div>

              <!--
                Slot-based carousel: 3 persistent DOM elements, each owns its
                own image index + CSS position class. On rotation we reclassify
                two slots (CSS transition handles the glide) and freeze/fade
                the wrapping slot so it pops in cleanly without sliding across.
              -->
              <div class="carousel-stage"
                (touchstart)="onCarouselTouchStart($event)"
                (touchend)="onCarouselTouchEnd($event)"
                (touchmove)="$event.preventDefault()"
              >
                @for (slot of carouselSlots; track slot.id) {
                  <div
                    [class]="getSlotClass(slot)"
                    [style.background-image]="'url(' + getImageUrl(event!.image_urls[slot.imgIndex]) + ')'"
                    (mouseenter)="onSlotHover(slot)"
                  >
                    <!-- Left-arrow cue -->
                    @if (slot.position === 'left') {
                      <div class="carousel-arrow carousel-arrow-left">&#8249;</div>
                    }
                    <!-- Right-arrow cue -->
                    @if (slot.position === 'right') {
                      <div class="carousel-arrow carousel-arrow-right">&#8250;</div>
                    }
                    <!-- Dot indicators (only on center slot) -->
                    @if (slot.position === 'center') {
                      <div class="carousel-dots">
                        @for (img of event!.image_urls; track img; let i = $index) {
                          <span
                            class="carousel-dot"
                            [class.carousel-dot-active]="i === activeIndex"
                            (click)="goToIndex(i)"
                          ></span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Caption: photo count -->
              <p class="carousel-caption">
                {{ activeIndex + 1 }} / {{ event.image_urls.length }} Photos
              </p>
            </div>
          }
        }

        <div class="glass-card" style="padding:40px;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px;flex-wrap:wrap;gap:16px">
            <div>
              <h1 style="font-size:2rem;margin-bottom:8px">{{ event.title }}</h1>
              <span class="badge" [class]="getStatusClass(event.status)">{{ event.status }}</span>
              @if (+event.ticket_price > 0) {
                <span class="badge" [class]="event.refund_policy === 'REFUNDABLE' ? 'badge-success' : 'badge-danger'" style="margin-left:8px">
                  {{ event.refund_policy === 'REFUNDABLE' ? 'Refundable Event' : 'Non-Refundable Event' }}
                </span>
              } @else {
                <span class="badge" style="margin-left:8px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
                  <app-shiny-text text="FREE Event" color="#10b981" shineColor="#6ee7b7" [speed]="2.5" [spread]="1.2"></app-shiny-text>
                </span>
              }
              @if (event.seat_map_enabled) {
                <span class="badge badge-info" style="margin-left:8px">🪑 Seat Selection</span>
              }
            </div>
            @if (+event.ticket_price === 0) {
              <div style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px 32px;text-align:center;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(16,185,129,0.1)">
                <app-shiny-text
                  text="FREE"
                  color="#077533ff"
                  shineColor="#86debbff"
                  [speed]="2.5"
                  [spread]="1.2"
                  style="font-weight:800;font-size:2.2rem;letter-spacing:0.05em"
                ></app-shiny-text>
              </div>
            } @else {
              <div class="price-tag">
                <div class="price-label">Starting at</div>
                <div class="price-value">&#8377;{{ event.ticket_price }}</div>
              </div>
            }
          </div>

          @if (event.description) {
            <div class="event-description">
              <h3 class="section-title">About this Event</h3>
              <p>{{ event.description }}</p>
            </div>
          }

          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Date & Time</div>
              <div class="detail-content">
                <span class="detail-icon">📅</span>
                <div class="detail-value">
                  {{ event.event_date | date:'EEEE, MMMM d, y' }}
                  <span class="detail-value-highlight">{{ event.event_date | date:'h:mm a' }} IST</span>
                </div>
              </div>
            </div>
            
            @if (event.location) {
              <div class="detail-item">
                <div class="detail-label">Location</div>
                <div class="detail-content">
                  <span class="detail-icon">📍</span>
                  <div class="detail-value">{{ event.location }}</div>
                </div>
              </div>
            }
            
            @if (event.gate_open_time) {
              <div class="detail-item">
                <div class="detail-label">Gate Opens</div>
                <div class="detail-content">
                  <span class="detail-icon">🚪</span>
                  <div class="detail-value">
                    {{ event.gate_open_time | date:'EEE, MMM d' }}
                    <span class="detail-value-highlight">{{ event.gate_open_time | date:'h:mm a' }} IST</span>
                  </div>
                </div>
              </div>
            }
            
            @if (event.event_end_time) {
              <div class="detail-item">
                <div class="detail-label">Event Ends</div>
                <div class="detail-content">
                  <span class="detail-icon">🏁</span>
                  <div class="detail-value">
                    {{ event.event_end_time | date:'EEE, MMM d' }}
                    <span class="detail-value-highlight">{{ event.event_end_time | date:'h:mm a' }} IST</span>
                  </div>
                </div>
              </div>
            }
            
            <div class="detail-item">
              <div class="detail-label">Tickets Available</div>
              <div class="detail-content">
                <span class="detail-icon">🎟️</span>
                <div class="detail-value">{{ event.max_tickets - event.tickets_sold }} of {{ event.max_tickets }}</div>
              </div>
            </div>
            
            @if (event.seat_map_enabled && event.vip_price) {
              <div class="detail-item">
                <div class="detail-label">VIP Price</div>
                <div class="detail-content">
                  <span class="detail-icon">⭐</span>
                  <div class="detail-value">&#8377;{{ event.vip_price }}</div>
                </div>
              </div>
            }
            
            @if (event.seat_map_enabled && event.seat_rows && event.seat_columns) {
              <div class="detail-item">
                <div class="detail-label">Seat Layout</div>
                <div class="detail-content">
                  <span class="detail-icon">🪑</span>
                  <div class="detail-value">{{ event.seat_rows }} rows × {{ event.seat_columns }} seats</div>
                </div>
              </div>
            }
            
            @if (event.google_maps_url) {
              <div class="detail-item">
                <div class="detail-label">Venue Map</div>
                <div class="detail-content">
                  <span class="detail-icon">🗺️</span>
                  <div class="detail-value">
                    <a [href]="event.google_maps_url" target="_blank" rel="noopener noreferrer"
                       style="color:#eab308;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px">
                      View on Google Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (+event.ticket_price > 0) {
            <div class="glass-card" style="padding:18px;margin-top:20px;background:rgba(255,255,255,0.03)">
              @if (event.refund_policy === 'NON_REFUNDABLE') {
                <p style="margin:0 0 8px;color:#fca5a5;font-weight:600">Non-Refundable Event</p>
                <p style="margin:0;color:var(--text-secondary)">
                  Once a ticket is purchased, the attendee will not receive any refund if they cancel.
                </p>
              } @else {
                <p style="margin:0 0 8px;color:#86efac;font-weight:600">Refundable Event</p>
                <p style="margin:0;color:var(--text-secondary)">
                  If the attendee cancels their ticket, they will receive a full refund.
                </p>
                <p style="margin:10px 0 0;color:var(--text-muted)">
                  Refunds are allowed only if the ticket is cancelled at least 24 hours before the event start time.
                  If cancelled within 24 hours of the event start time, no refund will be issued.
                </p>
              }
            </div>
          }

          <!-- ── Purchase / Seat Section ──────────────────────────────────────── -->
          @if ((event.status === 'published' || (event.status === 'draft' && event.organizer_id === auth.currentUser?.id)) && auth.isAuthenticated) {
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
                    <div class="fee-row fee-total">
                      <span>Total</span>
                      <strong style="color:var(--accent-primary);font-size:1.25rem">&#8377;{{ getSubtotal() | number:'1.2-2' }}</strong>
                    </div>
                    <button class="btn btn-primary" style="margin-top:12px;width:100%" (click)="proceedToPayment()" [disabled]="lockingSeats">
                      @if (lockingSeats) {
                        <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                        Locking seats...
                      } @else if (getSubtotal() === 0) {
                        🎫 Book Tickets
                      } @else {
                        Proceed to Payment
                      }
                    </button>
                    @if (purchaseError) { <div class="alert alert-danger" style="margin-top:8px">{{ purchaseError }}</div> }
                  </div>
                }

              } @else {
                <!-- STANDARD QUANTITY MODE -->
                <h3 style="margin-bottom:8px">🎟️ Purchase Tickets</h3>
                <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:20px">
                  Select the number of tickets you'd like to purchase.
                </p>

                @if (purchaseSuccess) { <div class="alert alert-success">{{ purchaseSuccess }}</div> }
                @if (purchaseError) { <div class="alert alert-danger">{{ purchaseError }}</div> }

                <div class="quantity-selector-container" style="margin-bottom:24px">
                  <label style="display:block;margin-bottom:8px;color:var(--text-secondary);font-size:0.9rem">Select Quantity</label>
                  @if (ownedTicketCount > 0) {
                    <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 10px;padding:6px 12px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:8px;">
                      🎟️ You already own <strong>{{ ownedTicketCount }}/5</strong> ticket{{ ownedTicketCount !== 1 ? 's' : '' }} for this event.
                      @if (ownedTicketCount >= 5) { You have reached the maximum limit. }
                    </p>
                  }
                  <div class="quantity-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
                    @for (n of getAvailableOptions(); track n) {
                      <button 
                        class="qty-btn" 
                        [class.active]="quantity === n"
                        (click)="quantity = n"
                        [disabled]="lockingSeats">
                        {{ n }}
                      </button>
                    }
                    @if (getAvailableOptions().length === 0) {
                      <p style="grid-column: span 5; color: var(--danger); text-align: center; padding: 10px;">Sold Out</p>
                    }
                  </div>
                </div>

                <div class="purchase-summary" style="margin-bottom:20px">
                  <div class="fee-row">
                    <span style="color:var(--text-secondary)">Total Amount</span>
                    <strong style="font-size:1.4rem;font-weight:700;color:var(--accent-primary)">
                      {{ calculateTotal() | currency:'INR' }}
                    </strong>
                  </div>
                </div>
                  
                @if (!auth.isOrganizer && getAvailableOptions().length > 0) {
                  <button class="btn btn-primary" style="width:100%" (click)="proceedToPaymentStandard()" [disabled]="lockingSeats">
                    @if (lockingSeats) {
                      <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
                      Holding tickets...
                    } @else if (calculateTotal() === 0) { 
                      🎫 Book Tickets 
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

          <!-- ── Event Actions (Organizer Only) ────────────────────────── -->
          @if (event.organizer_id === auth.currentUser?.id && event.status !== 'cancelled') {
            @if (event.status === 'draft') {
              <div class="glass-card" style="padding:32px;border-color:rgba(234,179,8,0.3);margin-top:32px;text-align:center;background:rgba(234,179,8,0.05)">
                <h3 style="margin-bottom:8px;font-size:1.5rem">📝 Draft Event</h3>
                <p style="color:var(--text-secondary);font-size:1rem;margin-bottom:24px">This event is currently a draft and is not visible to the public. Publish it to start selling tickets!</p>
                <div style="display:flex;gap:16px;justify-content:center;max-width:400px;margin:0 auto">
                  <a [routerLink]="['/events', event.id, 'edit']" class="btn btn-secondary" style="flex:1">Edit Event</a>
                  <button class="btn btn-primary" (click)="publishEvent()" [disabled]="publishing" style="flex:1">
                    @if (publishing) { <span class="spinner-sm"></span> Publishing... }
                    @else { 🚀 Publish Event }
                  </button>
                </div>
                @if (publishError) { <div class="alert alert-danger" style="margin-top:16px">{{ publishError }}</div> }
              </div>
            } @else {
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:32px">
                <div class="glass-card" style="padding:24px;border-color:rgba(16,185,129,0.2)">
                  <h3 style="margin-bottom:8px">💂 Staff & Analytics</h3>
                  <p style="color:var(--text-secondary);font-size:0.9rem">Manage your event staff and view detailed sales analytics.</p>
                  <a [routerLink]="['/analytics', event.id]" class="btn btn-secondary" style="margin-top:12px;width:100%">
                    Go to Analytics →
                  </a>
                </div>
                <div class="glass-card" style="padding:24px;border-color:rgba(239,68,68,0.2)">
                  <h3 style="margin-bottom:8px">⚙️ Event Management</h3>
                  <p style="color:var(--text-secondary);font-size:0.9rem">Update event details or cancel if needed. Cancellation fees may apply.</p>
                  <div style="display:flex;gap:12px;margin-top:12px">
                    <a [routerLink]="['/events', event.id, 'edit']" class="btn btn-secondary" style="flex:1">Edit Event</a>
                    <button class="btn btn-danger" style="flex:1" (click)="openCancelModal()">Cancel Event</button>
                  </div>
                </div>
              </div>
            }
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

    <!-- Held Seats Conflict Popup -->
    @if (heldSeatsMessage) {
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px">
        <div style="background:#1e293b;border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.6)">
          <div style="font-size:3rem;margin-bottom:16px">🚔</div>
          <h3 style="color:#ef4444;margin:0 0 12px;font-size:1.2rem">Seats Already Held</h3>
          <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">{{ heldSeatsMessage }}</p>
          <button class="btn btn-primary" (click)="heldSeatsMessage = ''"
                  style="background:linear-gradient(135deg,#ef4444,#b91c1c);border:none">
            Choose Other Seats
          </button>
        </div>
      </div>
    }

    <!-- Cancellation Modal (Organizer Only) -->
    @if (showCancelModal && event) {
      <div class="modal-backdrop" (click)="closeCancelModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;padding-top:8vh">
        <div class="modal-content glass-card animate-scaleIn" (click)="$event.stopPropagation()" style="width:100%;max-width:500px;padding:32px;position:relative">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <h2 style="margin:0;font-size:1.5rem">🚫 Cancel Event</h2>
            <button (click)="closeCancelModal()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer">✕</button>
          </div>
          
          <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);padding:20px;border-radius:12px;color:#fca5a5">
            <p><strong>Are you sure you want to cancel "{{ event.title }}"?</strong></p>
            <ul style="margin:12px 0;padding-left:20px;font-size:0.9rem">
              @if (event.tickets_sold > 0) {
                <li>All {{ event.tickets_sold }} attendees will receive a <strong>FULL REFUND</strong>.</li>
                <li>A <strong>15% cancellation fee</strong> (₹{{ (totalRevenue() * 0.15).toFixed(2) }}) will be charged.</li>
              } @else {
                <li>No tickets have been sold yet. No penalty will be charged.</li>
              }
              <li>This action <strong>cannot be undone</strong>.</li>
            </ul>
          </div>

          <div class="form-group" style="margin-top:20px">
            <label>Reason for Cancellation (Optional)</label>
            <textarea class="form-control" [(ngModel)]="cancelReason" placeholder="e.g. Unforeseen circumstances, venue issue..." rows="3"></textarea>
          </div>

          @if (cancelError) {
            <div style="background:rgba(239,68,68,0.15);color:#fca5a5;padding:12px;border-radius:8px;font-size:0.85rem;border:1px solid var(--danger);margin-top:16px">
              {{ cancelError }}
            </div>
          }

          <div style="display:flex;gap:12px;margin-top:32px;justify-content:flex-end">
            <button class="btn btn-secondary" (click)="closeCancelModal()" [disabled]="cancelling">Go Back</button>
            <button class="btn btn-danger" (click)="confirmCancellation()" [disabled]="cancelling">
              @if (cancelling) { <span class="spinner-sm"></span> Processing... }
              @else { 🚨 Confirm Cancellation }
            </button>
          </div>
        </div>
      </div>
    }
  `,

  styles: [`
    .price-tag { text-align:right; padding:16px 24px; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-glass); }
    .price-label { font-size:.75rem; color:var(--text-muted); text-transform:uppercase; }
    .price-value { font-size:1.8rem; font-weight:700; font-family:'Poppins',sans-serif; background:var(--accent-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .event-description {
      margin-top: 16px;
      margin-bottom: 32px;
      padding: 24px 32px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
    }
    .event-description p {
      color: var(--text-secondary);
      line-height: 1.8;
      font-size: 1.05rem;
      white-space: pre-line;
      margin: 0;
    }
    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 0;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title::before {
      content: '';
      display: block;
      width: 4px;
      height: 16px;
      background: #eab308;
      border-radius: 4px;
    }

    .detail-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
      gap: 16px; 
      margin-bottom: 32px;
    }
    .detail-item { 
      padding: 24px; 
      background: rgba(255, 255, 255, 0.02); 
      border: 1px solid rgba(255, 255, 255, 0.05); 
      border-radius: 16px; 
      transition: all 0.3s ease;
    }
    .detail-item:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }
    .detail-label { 
      font-size: 0.85rem; 
      color: var(--text-muted); 
      margin-bottom: 10px; 
      margin-left: 32px; /* align with text, accounting for icon + gap */
    }
    .detail-content {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .detail-icon {
      font-size: 1.25rem;
      line-height: 1.4; /* align with first line of text */
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    }
    .detail-value { 
      font-weight: 600; 
      font-size: 1.05rem;
      color: var(--text-primary);
      line-height: 1.5;
    }
    .detail-value-highlight {
      color: #eab308;
      font-size: 0.95rem;
      font-weight: 600;
      display: block;
      margin-top: 6px;
    }
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
  .qty-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-primary);
    padding: 12px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .qty-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
    transform: translateY(-2px);
  }
  .qty-btn.active {
    background: var(--accent-gradient);
    border-color: transparent;
    box-shadow: 0 8px 20px rgba(168, 85, 247, 0.3);
  }
  .qty-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

    /* ── Static single-image banner ───────────────────────────────────── */
    .static-banner {
      position: relative;
      height: 420px;
      border-radius: 18px;
      overflow: hidden;
      margin-top: 8px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .static-banner-bg {
      position: absolute;
      inset: -40px;
      background-size: cover;
      background-position: center;
      filter: blur(25px) brightness(0.55);
      opacity: 0.85;
      transform: scale(1.12);
    }
    .static-banner-fg {
      position: absolute;
      inset: 0;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      z-index: 1;
    }

    /* ── 3-D Carousel wrapper ──────────────────────────────────────────── */
    .carousel-wrapper {
      position: relative;
      margin-top: 12px;
      margin-bottom: 8px;
      padding: 24px 0 16px;
      border-radius: 22px;
      overflow: hidden;
    }

    /* Ambient gradient background of the entire carousel section */
    .carousel-bg-gradient {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 120% 80% at 50% 60%,
        rgba(168, 85, 247, 0.12) 0%,
        rgba(99, 102, 241, 0.08) 40%,
        rgba(15, 23, 42, 0.0) 100%
      );
      pointer-events: none;
    }

    /*
     * The "stage" creates a 3-D perspective space.
     * All child .carousel-item elements are positioned relative to this.
     */
    .carousel-stage {
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1200px;          /* Controls depth of 3-D field */
      height: 380px;
      position: relative;
    }

    /* ── Shared card styles ── */
    .carousel-item {
      position: absolute;
      background-size: cover;
      background-position: center;
      border-radius: 16px;
      cursor: pointer;
      /*
       * Smooth glide for ALL animatable properties.
       * cubic-bezier(0.25, 0.46, 0.45, 0.94) = ease-out quad:
       *   fast initial movement that decelerates naturally into the target,
       *   giving the impression of weight gliding into focus.
       */
      transition:
        transform  0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
        opacity    0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
        box-shadow 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
        filter     0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      will-change: transform, opacity, filter;
      user-select: none;
      overflow: hidden;
    }

    /*
     * CENTER card:
     *   - Full size (65% of stage width, tall)
     *   - No rotation, no translateZ depression → foregrounded via z-index
     *   - Bright, sharp, no grey filter
     */
    .carousel-center {
      width: 62%;
      height: 340px;
      transform: translateX(0) scale(1) rotateY(0deg);
      z-index: 10;
      opacity: 1;
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255,255,255,0.07);
      filter: none;
    }

    /*
     * LEFT card:
     *   - Shifted left (−34% of container), pushed back (scale 0.72)
     *   - Rotated +28° around Y-axis → curved perspective look
     *   - Semi-transparent, darker → sense of depth
     *   - Clips the card on a partial basis using translateZ only in perspective
     */
    .carousel-left {
      width: 62%;
      height: 340px;
      transform:
        translateX(-52%)           /* horizontal offset to the left  */
        scale(0.74)                /* shrink to create depth          */
        rotateY(28deg);            /* tilt away from viewer          */
      z-index: 5;
      opacity: 0.72;
      filter: brightness(0.75) saturate(0.85);
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
    }
    .carousel-left:hover {
      /*
       * Glide toward center:
       *   translateX: −52% → −26%  (moves ~half the distance to center)
       *   scale:        0.74 → 0.90 (grows noticeably larger, near center size)
       *   rotateY:      28°  →  8°  (flattens the tilt, card faces the viewer)
       *   opacity/filter: fully bright, no dimming
       */
      opacity: 1;
      filter: brightness(1) saturate(1.05);
      transform:
        translateX(-26%)
        scale(0.90)
        rotateY(8deg);
      z-index: 8;                   /* lift above right card during hover */
      box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    /*
     * RIGHT card:
     *   - Mirror of LEFT but shifted right, rotated −28°
     */
    .carousel-right {
      width: 62%;
      height: 340px;
      transform:
        translateX(52%)
        scale(0.74)
        rotateY(-28deg);
      z-index: 5;
      opacity: 0.72;
      filter: brightness(0.75) saturate(0.85);
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
    }
    .carousel-right:hover {
      /*
       * Mirror of left — glide toward center:
       *   translateX: +52% → +26%
       *   scale:        0.74 → 0.90
       *   rotateY:     −28° → −8°
       */
      opacity: 1;
      filter: brightness(1) saturate(1.05);
      transform:
        translateX(26%)
        scale(0.90)
        rotateY(-8deg);
      z-index: 8;
      box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    /* ── Hover arrow chevrons ── */
    .carousel-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 3.5rem;
      line-height: 1;
      color: rgba(255,255,255,0.85);
      text-shadow: 0 2px 12px rgba(0,0,0,0.6);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .carousel-arrow-left  { left:  10px; }
    .carousel-arrow-right { right: 10px; }

    .carousel-left:hover  .carousel-arrow-left,
    .carousel-right:hover .carousel-arrow-right {
      opacity: 1;
    }

    /* ── Dot indicators on center card ── */
    .carousel-dots {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 7px;
      z-index: 2;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.35);
      cursor: pointer;
      transition: background 0.3s ease, transform 0.3s ease;
    }
    .carousel-dot-active {
      background: #fff;
      transform: scale(1.35);
    }

    /* ── Caption below carousel ── */
    .carousel-caption {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.78rem;
      margin-top: 8px;
      letter-spacing: 0.04em;
    }

    /*
     * Kills ALL CSS transitions on a slot for one frame so the wrapping
     * card can be teleported to its new position without animating there.
     * Applied → removed in a single requestAnimationFrame cycle.
     */
    .no-transition {
      transition: none !important;
    }

    /*
     * Fades the wrapping card out while the two main slides are in motion.
     * Uses a shorter duration so it disappears before the other cards arrive.
     */
    .carousel-slot-fading {
      opacity: 0 !important;
      transition: opacity 0.22s ease !important;
    }

    /* ── Mobile Responsive ────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .page-container { padding: 12px; }
      .glass-card { padding: 20px 16px !important; }
      h1 { font-size: 1.4rem !important; }
      .carousel-stage {
        height: 220px;
        perspective: 600px;
      }
      .carousel-center {
        width: 80%;
        height: 200px;
      }
      .carousel-left {
        width: 80%;
        height: 200px;
        transform: translateX(-52%) scale(0.72) rotateY(22deg);
      }
      .carousel-left:hover {
        transform: translateX(-26%) scale(0.88) rotateY(6deg);
      }
      .carousel-right {
        width: 80%;
        height: 200px;
        transform: translateX(52%) scale(0.72) rotateY(-22deg);
      }
      .carousel-right:hover {
        transform: translateX(26%) scale(0.88) rotateY(-6deg);
      }
      .static-banner { height: 200px; }
      .detail-grid {
        grid-template-columns: 1fr !important;
        gap: 10px;
      }
      .detail-item { padding: 16px; }
      .detail-label { font-size: 0.78rem; margin-left: 28px; }
      .detail-value { font-size: 0.9rem; }
      .detail-value-highlight { font-size: 0.85rem; }
      .price-tag { padding: 12px 16px; }
      .price-value { font-size: 1.4rem !important; }
      .quantity-grid { grid-template-columns: repeat(3, 1fr) !important; }
      [style*="grid-template-columns:1fr 1fr"] { grid-template-columns: 1fr !important; }
      .event-description { padding: 16px; }
      .event-description p { font-size: 0.9rem; }
    }

    @media (max-width: 480px) {
      .carousel-stage { height: 180px; }
      .carousel-center { width: 88%; height: 160px; }
      .carousel-left  { width: 88%; height: 160px; }
      .carousel-right { width: 88%; height: 160px; }
      .static-banner { height: 160px; }
      h1 { font-size: 1.2rem !important; }
    }
`]
})
export class EventDetailComponent implements OnInit, OnDestroy {
  event: ScanEvent | null = null;
  loading = true;

  // ── Carousel state ────────────────────────────────────────────────────────
  /** Index into event.image_urls that is currently in the CENTER slot. */
  activeIndex = 0;

  /**
   * Three persistent slot descriptors. Each slot is a stable DOM element
   * (tracked by `id`) that independently owns its image index and
   * visual position class. Moving between positions is handled by changing
   * `position` — the shared CSS transition on .carousel-item does the rest.
   */
  carouselSlots: { id: number; imgIndex: number; position: 'left' | 'center' | 'right'; fading: boolean; noTransition: boolean }[] = [];

  /** Guard flag — prevents double-firing during a transition. */
  isAnimating = false;

  // Standard mode
  quantity = 1;
  ticketType: 'standard' | 'vip' = 'standard';
  ticketQtyOptions = [1, 2, 3, 4, 5];
  ownedTicketCount = 0;  // How many active tickets this user already owns for this event

  // Seat mode
  selectedSeats: EventSeat[] = [];

  // Payment flow
  lockingSeats = false;
  showPaymentModal = false;
  paymentDetails: PaymentDetails | null = null;
  lockedSeatIds: string[] = [];
  currentHoldId: string | null = null;
  lockedUntil = '';
  purchasing = false;
  purchaseSuccess = '';
  purchaseError = '';

  // Staff management (fields kept for template compatibility)
  staffEmail = '';
  assigningStaff = false;
  staffSuccess = '';
  staffError = '';
  heldSeatsMessage = '';

  // Cancellation (Organizer Only)
  showCancelModal = false;
  cancelReason = '';
  cancelling = false;
  cancelError = '';

  // Publishing Drafts
  publishing = false;
  publishError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private ticketService: TicketService,
    private seatService: SeatService,
    private paymentService: PaymentService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.eventService.getEvent(id).subscribe({
      next: (event) => {
        // Ensure numeric types to prevent NaN in template
        event.max_tickets = Number(event.max_tickets) || 0;
        event.tickets_sold = Number(event.tickets_sold) || 0;
        
        this.event = event;
        this.loading = false;

        // Initialise 3-slot carousel descriptors now that image_urls is available
        this.initCarousel();

        // Fetch how many tickets this attendee already owns for this event
        if (this.auth.isAuthenticated && !this.auth.isOrganizer) {
          this.ticketService.getMyTicketCountForEvent(event.id).subscribe({
            next: (res) => {
              this.ownedTicketCount = res.count;
              // Recalculate available options now that we know owned count
              const max = this.getAvailableOptions();
              if (max.length > 0 && this.quantity > max[max.length - 1]) {
                this.quantity = max[max.length - 1];
              } else if (max.length === 0) {
                this.quantity = 0;
              }
              this.cdr.detectChanges();
            },
            error: () => { /* ignore — will just show full options */ }
          });
        }

        // Adjust quantity if current selection exceeds availability
        const max = this.getAvailableOptions();
        if (max.length > 0 && this.quantity > max[max.length - 1]) {
          this.quantity = max[max.length - 1];
        } else if (max.length === 0) {
          this.quantity = 0;
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() { }

  // ── Mobile swipe for carousel ─────────────────────────────────────────────
  private swipeTouchStartX = 0;

  onCarouselTouchStart(e: TouchEvent): void {
    this.swipeTouchStartX = e.touches[0].clientX;
  }

  onCarouselTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.swipeTouchStartX;
    const threshold = 40; // min px drag to trigger a swipe
    if (Math.abs(dx) < threshold) return;
    if (dx > 0) {
      this.rotateRight(); // swipe right → go to previous
    } else {
      this.rotateLeft();  // swipe left  → go to next
    }
  }

  // ── Carousel helpers ──────────────────────────────────────────────────────

  /**
   * Initialises the 3 slot descriptors after the event loads.
   * Slot 0 = left, Slot 1 = center, Slot 2 = right.
   */
  initCarousel(): void {
    if (!this.event?.image_urls?.length) return;
    const total = this.event.image_urls.length;
    this.carouselSlots = [
      { id: 0, imgIndex: (this.activeIndex - 1 + total) % total, position: 'left',   fading: false, noTransition: false },
      { id: 1, imgIndex: this.activeIndex,                        position: 'center', fading: false, noTransition: false },
      { id: 2, imgIndex: (this.activeIndex + 1) % total,          position: 'right',  fading: false, noTransition: false },
    ];
  }

  /** Builds the CSS class string for a slot based on its current state. */
  getSlotClass(slot: { position: string; fading: boolean; noTransition: boolean }): string {
    let cls = `carousel-item carousel-${slot.position}`;
    if (slot.fading)       cls += ' carousel-slot-fading';
    if (slot.noTransition) cls += ' no-transition';
    return cls;
  }

  /**
   * Dispatches to rotateRight / rotateLeft based on which slot was hovered.
   * No-op for the center slot or while an animation is in progress.
   */
  onSlotHover(slot: { position: string }): void {
    if (this.isAnimating) return;
    if (slot.position === 'left')  this.rotateRight();
    if (slot.position === 'right') this.rotateLeft();
  }

  /**
   * Right card → center (next image comes into focus).
   *
   * Motion plan:
   *   • rightSlot:  carousel-right  →  carousel-center   (slides left into center)
   *   • centerSlot: carousel-center →  carousel-left     (slides left into left)
   *   • leftSlot:   fades out; after slide completes, teleports to right with new image
   */
  rotateLeft(): void {
    if (this.isAnimating || !this.event?.image_urls?.length) return;
    this.isAnimating = true;
    const total = this.event.image_urls.length;

    const leftSlot   = this.carouselSlots.find(s => s.position === 'left')!;
    const centerSlot = this.carouselSlots.find(s => s.position === 'center')!;
    const rightSlot  = this.carouselSlots.find(s => s.position === 'right')!;

    // 1. Fade out the wrapping slot (left) immediately
    leftSlot.fading = true;

    // 2. Reclassify the two sliding slots — CSS transition fires automatically
    rightSlot.position  = 'center';
    centerSlot.position = 'left';
    this.cdr.detectChanges();

    // 3. After the CSS transition finishes, clean up & update content
    setTimeout(() => {
      // Update activeIndex to the image that is now at center
      this.activeIndex = rightSlot.imgIndex;

      // Teleport leftSlot to the right without any transition
      leftSlot.fading       = true;        // keep invisible while teleporting
      leftSlot.noTransition = true;
      leftSlot.position     = 'right';
      leftSlot.imgIndex     = (this.activeIndex + 1) % total;
      this.cdr.detectChanges();

      // One RAF: remove no-transition, then fade back in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          leftSlot.noTransition = false;
          leftSlot.fading       = false;
          this.isAnimating      = false;
          this.cdr.detectChanges();
        });
      });
    }, 620);
  }

  /**
   * Left card → center (previous image comes into focus).
   *
   * Motion plan:
   *   • leftSlot:   carousel-left   →  carousel-center   (slides right into center)
   *   • centerSlot: carousel-center →  carousel-right    (slides right into right)
   *   • rightSlot:  fades out; after slide completes, teleports to left with new image
   */
  rotateRight(): void {
    if (this.isAnimating || !this.event?.image_urls?.length) return;
    this.isAnimating = true;
    const total = this.event.image_urls.length;

    const leftSlot   = this.carouselSlots.find(s => s.position === 'left')!;
    const centerSlot = this.carouselSlots.find(s => s.position === 'center')!;
    const rightSlot  = this.carouselSlots.find(s => s.position === 'right')!;

    // 1. Fade out the wrapping slot (right) immediately
    rightSlot.fading = true;

    // 2. Reclassify the two sliding slots — CSS transition fires automatically
    leftSlot.position   = 'center';
    centerSlot.position = 'right';
    this.cdr.detectChanges();

    // 3. After the CSS transition finishes, clean up & update content
    setTimeout(() => {
      // Update activeIndex to the image that is now at center
      this.activeIndex = leftSlot.imgIndex;

      // Teleport rightSlot to the left without any transition
      rightSlot.fading       = true;       // keep invisible while teleporting
      rightSlot.noTransition = true;
      rightSlot.position     = 'left';
      rightSlot.imgIndex     = (this.activeIndex - 1 + total) % total;
      this.cdr.detectChanges();

      // One RAF: remove no-transition, then fade back in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rightSlot.noTransition = false;
          rightSlot.fading       = false;
          this.isAnimating       = false;
          this.cdr.detectChanges();
        });
      });
    }, 620);
  }

  /**
   * Jump directly to a specific image index (dot indicator click).
   * Determines direction and delegates to rotateLeft/rotateRight.
   */
  goToIndex(targetIndex: number): void {
    if (this.isAnimating || !this.event?.image_urls?.length) return;
    if (targetIndex === this.activeIndex) return;
    const total = this.event.image_urls.length;
    // Determine shortest-path direction
    const fwd = (targetIndex - this.activeIndex + total) % total;
    const bwd = (this.activeIndex - targetIndex + total) % total;
    if (fwd <= bwd) {
      // Advance forward (right card direction) repeatedly — but for simplicity
      // do a single step toward the target
      this.rotateLeft();
    } else {
      this.rotateRight();
    }
  }

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
    return 0;
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
        
        const totalAmount = this.getSubtotal();

        this.paymentDetails = {
          baseAmount: totalAmount,
          convenienceFee: 0,
          totalAmount: totalAmount,
          seats: this.selectedSeats,
          event: this.event!,
          lockedUntil: resp.locked_until
        };
        this.showPaymentModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.lockingSeats = false;
        const errMsg: string = err.error?.message || '';
        if (err.status === 409 && errMsg.includes('held by someone else')) {
          this.heldSeatsMessage = errMsg;
        } else {
          this.purchaseError = errMsg || 'Could not lock selected seats. Another user may have taken them.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  onPaymentConfirmed() {
    this.showPaymentModal = false;
    this.purchaseSuccess = `🎉 Payment successful! Redirecting to your tickets...`;
    
    if (this.event) {
      if (this.event.seat_map_enabled) {
        this.event.tickets_sold += this.selectedSeats.length;
      } else {
        this.event.tickets_sold += this.quantity;
      }
    }
    
    this.selectedSeats = [];
    this.lockedSeatIds = [];
    this.currentHoldId = null;
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

    if (this.event.seat_map_enabled && this.lockedSeatIds.length > 0) {
      this.seatService.unlockSeats(this.event.id, this.lockedSeatIds).subscribe();
    } else if (!this.event.seat_map_enabled && this.currentHoldId) {
      this.ticketService.releaseHold(this.event.id, this.currentHoldId).subscribe();
    }

    this.lockedSeatIds = [];
    this.currentHoldId = null;
    this.showPaymentModal = false;
    this.paymentDetails = null;
    this.selectedSeats = [];
    this.cdr.detectChanges();
  }

  // ── STANDARD (NO SEAT-MAP) FLOW ────────────────────────────────────────────

  proceedToPaymentStandard() {
    if (!this.event || this.quantity <= 0) return;
    this.lockingSeats = true;
    this.purchaseError = '';
    this.cdr.detectChanges();

    this.ticketService.holdTickets(this.event.id, this.quantity).subscribe({
      next: (resp) => {
        this.lockingSeats = false;
        this.currentHoldId = resp.hold_id;
        
        const subtotal = this.quantity * Number(this.event!.ticket_price);
        const total = subtotal;

        this.paymentDetails = {
          baseAmount: subtotal,
          convenienceFee: 0,
          totalAmount: total,
          seats: [],
          quantity: this.quantity,
          event: this.event!,
          lockedUntil: resp.expires_at
        };
        this.showPaymentModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.lockingSeats = false;
        const errMsg: string = err.error?.message || '';
        if (err.status === 409) {
          this.heldSeatsMessage = errMsg;
        } else {
          this.purchaseError = errMsg || 'Could not hold tickets. They might have been taken by someone else.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  getAvailableOptions(): number[] {
    if (!this.event) return [];
    const available = this.event.max_tickets - this.event.tickets_sold;
    const maxAllowed = Math.max(0, 5 - this.ownedTicketCount);  // Respect 5-ticket limit
    const limit = Math.min(maxAllowed, available);
    const options = [];
    for (let i = 1; i <= limit; i++) {
      options.push(i);
    }
    return options;
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

  // Cancellation Methods
  openCancelModal() {
    this.showCancelModal = true;
    this.cancelReason = '';
    this.cancelError = '';
    this.cdr.detectChanges();
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.cdr.detectChanges();
  }

  totalRevenue() {
    if (!this.event) return 0;
    return parseFloat(this.event.ticket_price) * this.event.tickets_sold;
  }

  confirmCancellation() {
    if (!this.event) return;
    this.cancelling = true;
    this.cancelError = '';
    
    this.eventService.cancelEvent(this.event.id, this.cancelReason).subscribe({
      next: () => {
        this.cancelling = false;
        this.showCancelModal = false;
        if (this.event) this.event.status = 'cancelled';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cancelling = false;
        this.cancelError = err.error?.message || 'Failed to cancel event. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  // Publish Draft method
  publishEvent() {
    if (!this.event) return;
    this.publishing = true;
    this.publishError = '';
    this.eventService.updateEvent(this.event.id, { status: 'published' }).subscribe({
      next: (updatedEvent) => {
        this.publishing = false;
        if (this.event) this.event.status = 'published';
        this.purchaseSuccess = '✨ Event successfully published!';
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.purchaseSuccess = '';
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.publishing = false;
        this.publishError = err.error?.message || 'Failed to publish event. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
