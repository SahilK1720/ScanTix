import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventSeat } from '../../core/services/seat.service';
import { ScanEvent } from '../../core/services/event.service';
import { environment } from '../../../environments/environment';
import { PaymentService, RazorpayOrder } from '../../core/services/payment.service';
import { ShinyTextComponent } from '../components/shiny-text/shiny-text.component';

declare var Razorpay: any;

export interface PaymentDetails {
  baseAmount: number;
  convenienceFee: number;
  totalAmount: number;
  seats: EventSeat[];
  quantity?: number;
  event: ScanEvent;
  lockedUntil: string;
}

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ShinyTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop checkout-backdrop" (click)="onBackdropClick($event)">
      <div class="checkout-card" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="checkout-header">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <span>🎟️</span>
            </div>
            <div>
              <h2 class="checkout-title">Complete Payment</h2>
              <p class="checkout-subtitle">Secure Checkout</p>
            </div>
          </div>
          <div class="countdown-badge" [class.urgent]="timeLeft <= 60">
            <span>⏳</span> {{ formatTime(timeLeft) }}
          </div>
        </div>

        <!-- Order Summary -->
        <div class="order-container">
          <h3 class="section-title">Order Summary</h3>
          
          <div class="seats-list">
            @if (payment.seats.length > 0) {
              @for (seat of payment.seats; track seat.id) {
                <div class="seat-item">
                  <div class="seat-info">
                    <span class="seat-icon">🪑</span>
                    <span>{{ seat.row_label }}{{ seat.seat_number }}</span>
                    @if (seat.row_label === 'A' || seat.row_label === 'B') {
                      <span class="vip-tag">VIP</span>
                    }
                  </div>
                  <span class="seat-price">₹{{ getSeatPrice(seat) | number:'1.0-0' }}</span>
                </div>
              }
            } @else {
              <div class="seat-item">
                <div class="seat-info">
                  <span class="seat-icon">🎟️</span>
                  <span>{{ payment.quantity || 1 }} × Standard Ticket{{ (payment.quantity || 1) > 1 ? 's' : '' }}</span>
                </div>
                <span class="seat-price">₹{{ payment.baseAmount | number:'1.0-0' }}</span>
              </div>
            }
          </div>

          <div class="calculation-breakdown">
            <div class="calc-row">
              <span>Subtotal</span>
              <span>₹{{ payment.baseAmount | number:'1.0-0' }}</span>
            </div>
            <div class="divider-dashed"></div>
            <div class="calc-row grand-total">
              <span>Total</span>
              @if (payment.totalAmount === 0) {
                <app-shiny-text text="FREE" color="#10b981" shineColor="#34d399" [speed]="3" [spread]="1.5" className="price-highlight" style="font-size:1.5rem;letter-spacing:1px;font-weight:700"></app-shiny-text>
              } @else {
                <span class="price-highlight">₹{{ payment.totalAmount | number:'1.2-2' }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Razorpay Section -->
        <div class="payment-section">
          <div class="secure-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
            Payments are 100% secure & encrypted
          </div>
          
          <div class="action-stack">
            <button class="cancel-link" (click)="onCancel()" [disabled]="processing">
              Cancel
            </button>
            
            <button class="btn btn-primary razorpay-btn" (click)="payWithRazorpay()" [disabled]="processing">
              @if (processing) {
                <span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px"></span>
                {{ statusMessage || 'Processing...' }}
              } @else {
                <span class="btn-content">
                  <span>Pay ₹{{ payment.totalAmount | number:'1.2-2' }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/></svg>
                </span>
              }
            </button>
          </div>
        </div>

        @if (error) {
          <div class="alert alert-danger" style="margin:16px 24px">{{ error }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .checkout-backdrop {
      position: fixed; inset: 0; background: rgba(8, 12, 16, 0.9);
      backdrop-filter: blur(12px); z-index: 1000;
      display: flex; align-items: flex-start; justify-content: center; padding: 80px 16px 40px 16px;
      overflow-y: auto;
    }
    .checkout-card {
      width: 100%; max-width: 440px; padding: 0;
      margin: 0 auto; display: flex; flex-direction: column;
      max-height: calc(100vh - 120px); overflow: hidden;
      border-radius: 24px;
      background: linear-gradient(145deg, #1e293b, #0f172a);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

    .checkout-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px 24px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }
    .checkout-header::after {
      content: ''; position: absolute; top:0; left:0; right:0; height:1px;
      background: linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent);
    }
    .header-content { display: flex; align-items: center; gap: 14px; }
    .header-icon-wrapper {
      width: 44px; height: 44px; border-radius: 12px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;  
      box-shadow: inset 0 0 12px rgba(56, 189, 248, 0.2);
    }
    .checkout-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #f8fafc; }
    .checkout-subtitle { margin: 2px 0 0; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
    .countdown-badge {
      display: flex; align-items: center; gap: 6px;
      background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(234, 179, 8, 0.3);
      color: #eab308; padding: 6px 12px; border-radius: 99px;
      font-weight: 600; font-size: 0.9rem; font-family: monospace;
      box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
    }
    .countdown-badge.urgent {
      border-color: rgba(239, 68, 68, 0.5); color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
      animation: pulse 1s infinite;
    }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }

    .order-container {
      margin: 0 20px;
      background: rgba(15, 23, 42, 0.4);
      border-radius: 16px;
      padding: 20px 0;
      position: relative;
      flex: 1; min-height: 0; overflow-y: auto;
    }
    .order-container::-webkit-scrollbar { width: 4px; }
    .order-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; margin: 10px 0; }
    .order-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    .section-title {
      font-size: 0.75rem; color: #64748b; margin: 0 20px 16px;
      text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
      flex-shrink: 0;
    }
    
    .seats-list { 
      margin: 0 20px 16px; display: flex; flex-direction: column; gap: 10px; 
    }
    .seat-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 14px; background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 10px;
    }
    .seat-info { display: flex; align-items: center; gap: 8px; font-weight: 500; color: #e2e8f0; font-size: 0.95rem; }
    .seat-icon { font-size: 1rem; opacity: 0.8; }
    .vip-tag {
      background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
      font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      letter-spacing: 0.05em; text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .seat-price { font-weight: 600; color: #cbd5e1; }

    .calculation-breakdown { padding: 0 24px; }
    .calc-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; font-size: 0.9rem; color: #94a3b8;
    }
    .fee-row { font-size: 0.85rem; color: #64748b; }
    .divider-dashed {
      border-top: 1px dashed rgba(255,255,255,0.1); margin: 12px 0;
    }
    .grand-total { font-size: 1.15rem; font-weight: 700; color: #f8fafc; padding-bottom: 4px; }
    .price-highlight {
      font-size: 1.5rem;
      background: linear-gradient(to right, #38bdf8, #818cf8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }

    .payment-section { padding: 24px; text-align: center; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.05); }
    .secure-badge {
      display: inline-flex; align-items: center; gap: 6px;
      color: #10b981; font-size: 0.75rem; font-weight: 600;
      margin-bottom: 20px; background: rgba(16, 185, 129, 0.1);
      padding: 6px 14px; border-radius: 99px; border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .razorpay-btn {
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      border: none; box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.4);
      height: 52px; font-size: 1.05rem; font-weight: 700;
      border-radius: 12px; transition: all 0.3s ease;
      flex: 1; display: flex; align-items: center; justify-content: center;
    }
    .razorpay-btn:hover {
      transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(14, 165, 233, 0.5);
    }
    .btn-content { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; }
    
    .action-stack {
      display: flex; flex-direction: row; align-items: center; justify-content: space-between;
      gap: 16px; width: 100%;
    }
    .cancel-link {
      background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1;
      font-size: 0.95rem; font-weight: 600; cursor: pointer; border-radius: 12px;
      height: 52px; padding: 0 20px; flex-shrink: 0;
      transition: all 0.2s; display: flex; align-items: center; justify-content: center;
    }
    .cancel-link:hover { background: rgba(255, 255, 255, 0.1); color: #f8fafc; }
  `]
})
export class PaymentModalComponent implements OnInit, OnDestroy {
  @Input() payment!: PaymentDetails;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  processing = false;
  statusMessage = '';
  error = '';

  timeLeft = 480;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    const expiresAt = new Date(this.payment.lockedUntil).getTime();
    this.timer = setInterval(() => {
      this.timeLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      if (this.timeLeft === 0) {
        this.onTimeout();
      }
      this.cdr.markForCheck();
    }, 1000);
    this.timeLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  payWithRazorpay() {
    this.processing = true;
    this.statusMessage = 'Initializing payment...';
    this.error = '';
    this.cdr.markForCheck();

    this.ensureRazorpayLoaded().then(() => {
      this.statusMessage = 'Creating order...';
      this.cdr.markForCheck();

      // Amount in paise
      const amountPaise = Math.round(this.payment.totalAmount * 100);
      const seatIds = this.payment.seats.map(s => s.id);

      this.paymentService.createOrder(amountPaise, this.payment.event.id, seatIds).subscribe({
        next: (order: RazorpayOrder) => {
          this.openRazorpay(order);
        },
        error: (err) => {
          this.processing = false;
          this.error = 'Failed to initialize payment. Please try again.';
          this.cdr.markForCheck();
        }
      });
    }).catch(err => {
      this.processing = false;
      this.error = 'Failed to load Payment Gateway. Please check your internet connection.';
      this.cdr.markForCheck();
    });
  }

  private ensureRazorpayLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject('Razorpay SDK load failed');
      document.body.appendChild(script);
    });
  }

  private openRazorpay(order: RazorpayOrder) {
    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'PickMySeat',
      description: `Tickets for ${this.payment.event.title}`,
      order_id: order.order_id,
      handler: (response: any) => {
        this.verifyPayment(response, order);
      },
      prefill: {
        name: 'Test User',
        email: 'test@example.com',
        contact: '9999999999'
      },
      theme: {
        color: '#339aff'
      },
      modal: {
        ondismiss: () => {
          this.processing = false;
          this.statusMessage = '';
          this.cdr.markForCheck();
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  private verifyPayment(rzpResponse: any, order: RazorpayOrder) {
    this.statusMessage = 'Verifying payment...';
    this.cdr.markForCheck();

    const seatIds = this.payment.seats.map(s => s.id);

    this.paymentService.verifyAndBook({
      razorpay_order_id: rzpResponse.razorpay_order_id,
      razorpay_payment_id: rzpResponse.razorpay_payment_id,
      razorpay_signature: rzpResponse.razorpay_signature,
      event_id: order.event_id,
      seat_ids: seatIds.length > 0 ? seatIds : undefined,
      quantity: seatIds.length > 0 ? undefined : (this.payment.quantity || 1)
    }).subscribe({
      next: () => {
        this.statusMessage = 'Payment successful!';
        this.cdr.markForCheck();
        setTimeout(() => this.confirmed.emit(), 1000);
      },
      error: (err) => {
        this.processing = false;
        this.statusMessage = '';
        this.error = 'Payment verification failed. If money was deducted, please contact support.';
        this.cdr.markForCheck();
      }
    });
  }

  getSeatPrice(seat: EventSeat): number {
    const isVip = seat.row_label === 'A' || seat.row_label === 'B';
    if (isVip && this.payment.event.vip_price) {
      return Number(this.payment.event.vip_price);
    }
    return Number(this.payment.event.ticket_price);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  onCancel() {
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent) {
    // Prevent accidental close
  }

  private onTimeout() {
    if (this.timer) clearInterval(this.timer);
    this.error = '⏰ Payment time expired. Your seats have been released.';
    this.cdr.markForCheck();
    setTimeout(() => this.cancelled.emit(), 3000);
  }
}
