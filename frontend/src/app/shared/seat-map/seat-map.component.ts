import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeatService, EventSeat } from '../../core/services/seat.service';

interface SeatRow {
  label: string;
  seats: EventSeat[];
}

@Component({
  selector: 'app-seat-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seat-map-wrapper">
      <!-- Stage -->
      @if (layoutType !== 'stadium') {
        <div class="stage-bar">🎭 STAGE / SCREEN</div>
      }

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item"><span class="dot available"></span>Available</span>
        <span class="legend-item"><span class="dot vip-legend"></span>VIP (Row A/B)</span>
        <span class="legend-item"><span class="dot mine"></span>Selected by you</span>
        <span class="legend-item"><span class="dot locked"></span>Held by someone</span>
        <span class="legend-item"><span class="dot booked"></span>Booked</span>
      </div>

      @if (loading) {
        <div class="map-loading"><div class="spinner"></div><span>Loading seat map…</span></div>
      } @else if (rows.length === 0) {
        <div class="map-empty">No seats configured for this event.</div>
      } @else {
          <div class="map-viewport">
            <div #scrollContainer class="grid-scroll" 
                 [class.is-stadium]="layoutType === 'stadium'"
                 [class.is-panning]="isPanning"
                 (mousedown)="startPanning($event)"
                 (mousemove)="pan($event)"
                 (mouseup)="stopPanning()"
                 (mouseleave)="stopPanning()"
                 (touchstart)="startTouchPan($event)"
                 (touchmove)="touchPan($event)"
                 (touchend)="stopTouchPan()">
              <div class="zoom-pane" [ngStyle]="{'transform': 'scale(' + zoomLevel + ')'}">
                @if (layoutType === 'stadium') {
                  <div class="stadium-container" [ngStyle]="getStadiumStyle()">
                <div class="grass-field" [ngStyle]="getGrassStyle()"></div>
                <div class="pitch" [ngStyle]="getPitchStyle()">PITCH</div>
                    @for (row of rows; track row.label; let rowIndex = $index) {
                      @for (seat of row.seats; track seat.id; let seatIndex = $index) {
                        <button
                          class="seat stadium-seat"
                          [class]="getSeatClass(seat)"
                          [disabled]="isSeatDisabled(seat)"
                          [class.vip]="seat.row_label === 'A' || seat.row_label === 'B'"
                          [ngStyle]="getSeatStyle(seatIndex, row.seats.length, rowIndex, rows.length)"
                          (click)="onSeatClick(seat)"
                          [title]="getSeatTooltip(seat)">
                          {{row.label}}{{seat.seat_number}}
                          @if (isMyLock(seat)) {
                            @if (getCountdown(seat); as cd) {
                              <span class="countdown">{{ cd }}</span>
                            }
                          }
                        </button>
                      }
                    }
                  </div>
                } @else {
                  @for (row of rows; track row.label) {
                    <div class="seat-row">
                      <div class="row-label">{{ row.label }}</div>
                      @for (seat of row.seats; track seat.id) {
                        <button
                          class="seat"
                          [class]="getSeatClass(seat)"
                          [disabled]="isSeatDisabled(seat)"
                          [class.vip]="seat.row_label === 'A' || seat.row_label === 'B'"
                          (click)="onSeatClick(seat)"
                          [title]="getSeatTooltip(seat)">
                          {{ seat.seat_number }}
                          @if (isMyLock(seat)) {
                            @if (getCountdown(seat); as cd) {
                              <span class="countdown">{{ cd }}</span>
                            }
                          }
                        </button>
                      }
                    </div>
                  }
                }
              </div>
            </div>

            @if (layoutType === 'stadium') {
              <div class="zoom-controls">
                <button class="zoom-btn" (click)="zoomIn()" title="Zoom In">+</button>
                <div class="zoom-level">{{ (zoomLevel * 100).toFixed(0) }}%</div>
                <button class="zoom-btn" (click)="zoomOut()" title="Zoom Out">-</button>
                <button class="zoom-btn" (click)="resetZoom()" title="Reset Zoom" style="font-size: 0.8rem">↺</button>
              </div>
            }
          </div>
      }

      @if (mySeats.length > 0) {
        <div class="selection-summary">
          <span>{{ mySeats.length }} seat(s) selected:</span>
          @for (s of mySeats; track s.id) {
            <span class="tag">
              {{ s.row_label }}{{ s.seat_number }}
              <button class="tag-remove" (click)="deselect(s)">✕</button>
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .seat-map-wrapper { display:flex; flex-direction:column; gap:16px; }

    .stage-bar {
      text-align:center; padding:10px 24px;
      background:linear-gradient(135deg,rgba(234,179,8,.25),rgba(250,204,21,.25));
      border:1px solid rgba(234,179,8,.4); border-radius:8px;
      font-weight:700; letter-spacing:.1em; font-size:.85rem; color:var(--text-secondary);
    }

    .legend { display:flex; gap:20px; flex-wrap:wrap; justify-content:center; }
    .legend-item { display:flex; align-items:center; gap:6px; font-size:.8rem; color:var(--text-secondary); }
    .dot { width:14px; height:14px; border-radius:3px; }
    .dot.available { background:#3b82f6; }
    .dot.vip-legend { background:transparent; border: 2px solid #7c3aed; box-shadow: 0 0 5px rgba(124,58,237,0.5); }
    .dot.mine { background:#22c55e; }
    .dot.locked { background:#f59e0b; }
    .dot.booked { background:#6b7280; }

    .map-loading, .map-empty {
      display:flex; align-items:center; gap:12px; justify-content:center;
      padding:40px; color:var(--text-muted);
    }

    .map-viewport { position:relative; overflow:hidden; border-radius:12px; }

    .grid-scroll { 
      overflow:auto; max-height:80vh; position:relative; display:flex; flex-direction:column; 
      cursor: grab; user-select: none;
    }
    .grid-scroll.is-panning { cursor: grabbing; scroll-behavior: auto; }
    .grid-scroll:not(.is-stadium) { cursor: default; }
    .grid-scroll.is-stadium { background:rgba(0,0,0,0.1); border-radius:12px; padding:40px; min-height:500px; }
    .grid-scroll.is-stadium .zoom-pane { margin: auto; }

    .stadium-container { position:relative; margin:0 auto; transform-origin: top center; transition: transform 0.2s ease-out; }
    .grass-field {
      position:absolute;
      background: #1c5b3480; /* Light green grass */
      border-radius: 50%;
      z-index: 5;
      box-shadow: inset 0 0 40px rgba(0,0,0,0.1);
    }
    .pitch {
      position:absolute;
      background: #ca5c1873; /* Brown pitch */
      display:flex; align-items:center; justify-content:center;
      color:#fef3c7; font-weight:800; font-size:.8rem; letter-spacing:2px;
      writing-mode:vertical-lr; text-orientation:upright;
      box-shadow:0 0 20px rgba(0,0,0,0.4); z-index:10;
      border: 2px solid #542203ff;
    }

    .zoom-controls {
      position: absolute; bottom: 20px; left: 20px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 100;
    }
    .zoom-btn {
      width: 40px; height: 40px; border-radius: 8px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      color: var(--text-primary); font-size: 1.2rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    }
    .zoom-btn:hover { background: var(--bg-tertiary); border-color: var(--accent-primary); }
    .zoom-btn:active { transform: scale(0.95); }
    .zoom-level {
      background: rgba(0,0,0,0.5); color: white; padding: 4px 8px;
      border-radius: 4px; font-size: 0.7rem; text-align: center;
    }

    .zoom-pane { 
      transform-origin: center center; 
      transition: transform 0.2s ease-out;
      width: fit-content; height: fit-content;
    }

    .stadium-seat {
      position:absolute; top:50%; left:50%;
      width:30px; height:30px; font-size:.55rem;
    }

    .seat-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; min-width:max-content; }
    .row-label {
      width:28px; font-size:.75rem; font-weight:700; color:var(--text-muted);
      text-align:center; flex-shrink:0;
    }

    .seat {
      position:relative;
      width:24px; height:24px; border-radius:4px 4px 2px 2px;
      border:none; font-size:.6rem; font-weight:600;
      cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center;
    }
    .seat:hover:not(:disabled) { filter:brightness(1.15); box-shadow:0 4px 14px rgba(0,0,0,.4); z-index: 10; }
    .seat:disabled { cursor:not-allowed; opacity:.85; }

    .seat.available { background:#3b82f6; color:#fff; }
    .seat.mine { background:linear-gradient(135deg,#22c55e,#4ade80); color:#fff; box-shadow:0 0 10px rgba(34,197,94,.5); }
    .seat.locked { background:#f59e0b; color:#fff; }
    .seat.booked { background:#374151; color:#9ca3af; }
    .seat.vip:not(:disabled):not(.mine) { 
      border: 2px solid #7c3aed; 
      box-shadow: 0 0 10px rgba(124,58,237,0.4);
      background: rgba(124,58,237,0.1);
    }
    .seat.vip.available:not(:disabled):not(.mine) {
       background: rgba(124,58,237,0.2);
    }

    .countdown {
      display: none !important;
      position:absolute; bottom:-16px; left:50%; transform:translateX(-50%);
      font-size:.6rem; color:#a78bfa; white-space:nowrap; pointer-events:none;
    }

    .selection-summary {
      display:flex; flex-wrap:wrap; gap:8px; align-items:center;
      padding:12px 16px; background:rgba(234,179,8,.08);
      border-radius:8px; border:1px solid rgba(234,179,8,.2);
      font-size:.85rem; color:var(--text-secondary);
    }
    .tag {
      display:inline-flex; align-items:center; gap:6px;
      background:rgba(234,179,8,.2); border-radius:20px;
      padding:3px 10px; font-size:.8rem; color:var(--text-primary);
    }
    .tag-remove {
      background:none; border:none; cursor:pointer; padding:0;
      color:var(--text-muted); font-size:.75rem; line-height:1;
    }
    .tag-remove:hover { color:#ef4444; }
  `]
})
export class SeatMapComponent implements OnInit, OnDestroy {
  @Input() eventId!: string;
  @Input() currentUserId: string | null = null;
  @Input() layoutType: string = 'grid';
  @Input() selectedSeats: EventSeat[] = []; // This input is not used internally, mySeats is the source of truth
  @Input() readOnly: boolean = false;

  @Output() selectionChanged = new EventEmitter<EventSeat[]>();

  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLElement>;

  zoomLevel = 1.0; // Default to 1.0 for non-stadium
  isPanning = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;

  rows: SeatRow[] = [];
  loading = true;
  mySeats: EventSeat[] = []; // Seats locally selected (before payment lock)

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private seatsMap = new Map<string, EventSeat>();

  constructor(
    private seatService: SeatService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadSeats();
    // Poll every 5 seconds for real-time updates
    this.pollInterval = setInterval(() => this.loadSeats(), 5000);
    // Tick countdown every second
    this.timerInterval = setInterval(() => this.cdr.markForCheck(), 1000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.1, 2.5);
    this.cdr.markForCheck();
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.3);
    this.cdr.markForCheck();
  }

  fitToView() {
    if (this.layoutType !== 'stadium' || !this.scrollContainer) {
      this.zoomLevel = 1.0;
      this.cdr.markForCheck();
      return;
    }

    const { size } = this.getStadiumLayoutConstants();
    const container = this.scrollContainer.nativeElement;
    const padding = 80;
    const availableW = container.clientWidth - padding;
    const availableH = container.clientHeight - padding;

    const scaleW = availableW / size;
    const scaleH = availableH / size;

    this.zoomLevel = Math.max(0.3, Math.min(scaleW, scaleH, 1.0));
    this.cdr.markForCheck();
    
    // Center scroll after zoom change
    setTimeout(() => this.centerScroll(), 50);
  }

  centerScroll() {
    if (!this.scrollContainer) return;
    const el = this.scrollContainer.nativeElement;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }

  resetZoom() {
    this.zoomLevel = 0.5;
    this.cdr.markForCheck();
    setTimeout(() => this.centerScroll(), 50);
  }

  startPanning(e: MouseEvent) {
    if (this.layoutType !== 'stadium') return;
    const el = e.currentTarget as HTMLElement;
    this.isPanning = true;
    this.startX = e.pageX - el.offsetLeft;
    this.startY = e.pageY - el.offsetTop;
    this.scrollLeft = el.scrollLeft;
    this.scrollTop = el.scrollTop;
  }

  pan(e: MouseEvent) {
    if (!this.isPanning) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    const walkX = (x - this.startX) * 1.5;
    const walkY = (y - this.startY) * 1.5;
    el.scrollLeft = this.scrollLeft - walkX;
    el.scrollTop = this.scrollTop - walkY;
  }

  stopPanning() {
    this.isPanning = false;
  }

  private touchStartX = 0;
  private touchStartY = 0;
  private touchScrollLeft = 0;
  private touchScrollTop = 0;

  startTouchPan(e: TouchEvent) {
    if (this.layoutType !== 'stadium') return;
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    this.isPanning = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchScrollLeft = el.scrollLeft;
    this.touchScrollTop = el.scrollTop;
  }

  touchPan(e: TouchEvent) {
    if (!this.isPanning || this.layoutType !== 'stadium') return;
    e.preventDefault();
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const dx = this.touchStartX - e.touches[0].clientX;
    const dy = this.touchStartY - e.touches[0].clientY;
    el.scrollLeft = this.touchScrollLeft + dx;
    el.scrollTop = this.touchScrollTop + dy;
  }

  stopTouchPan() {
    this.isPanning = false;
  }

  private loadSeats() {
    this.seatService.getEventSeats(this.eventId).subscribe({
      next: (seats) => {
        seats.forEach(s => {
          const local = this.seatsMap.get(s.id);
          const isOptimisticMine = local?.status === 'locked' && local?.locked_by === this.currentUserId;

          if (isOptimisticMine) {
            // If server says someone else booked/locked it, we lost our lock priority.
            if (s.status === 'booked' || (s.status === 'locked' && s.locked_by !== this.currentUserId)) {
              this.seatsMap.set(s.id, s);
            } else if (s.status === 'locked' && s.locked_by === this.currentUserId) {
              // Server confirmed our lock; update lock_until for exact countdown
              this.seatsMap.set(s.id, s);
            }
            // If server says 'available', the lock API might still be inflight.
            // We KEEP our local 'locked' state so the UI doesn't flicker.
          } else {
            // Not ours locally, so trust the server state completely.
            this.seatsMap.set(s.id, s);
          }
        });

        // Rebuild mySeats — keep locally selected seats if they are still available
        this.mySeats = this.mySeats.filter(s => {
          const fresh = this.seatsMap.get(s.id);
          // Keep if still available or if it's locked by us (we did a payment lock)
          return fresh && (fresh.status === 'available' || (fresh.status === 'locked' && fresh.locked_by === this.currentUserId));
        });

        const isInitialLoad = this.loading;
        this.rows = this.buildRows(Array.from(this.seatsMap.values()));
        this.loading = false;
        this.selectionChanged.emit(this.mySeats);
        this.cdr.markForCheck();

        if (isInitialLoad) {
          // Wrap in timeout to let DOM render before fitting/centering
          setTimeout(() => {
            if (this.layoutType === 'stadium') {
              // Use 30% zoom on mobile, 50% on desktop
              this.zoomLevel = window.innerWidth < 768 ? 0.3 : 0.5;
              this.cdr.markForCheck();
              this.centerScroll();
            } else {
              this.zoomLevel = 1.0;
              this.cdr.markForCheck();
            }
          }, 100);
        }
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildRows(seats: EventSeat[]): SeatRow[] {
    const map = new Map<string, EventSeat[]>();
    for (const seat of seats) {
      const arr = map.get(seat.row_label) ?? [];
      arr.push(seat);
      map.set(seat.row_label, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        // Sort by length first (A vs AA), then alphabetically
        if (a.length !== b.length) return a.length - b.length;
        return a.localeCompare(b);
      })
      .map(([label, s]) => ({
        label,
        seats: s.sort((a, b) => a.seat_number - b.seat_number)
      }));
  }

  isMySelection(seat: EventSeat): boolean {
    return this.mySeats.some(s => s.id === seat.id);
  }

  isMyLock(seat: EventSeat): boolean {
    // locked on server by this user (after payment click)
    const fresh = this.seatsMap.get(seat.id);
    return !!fresh && fresh.status === 'locked' && fresh.locked_by === this.currentUserId;
  }

  isSeatDisabled(seat: EventSeat): boolean {
    if (this.isMySelection(seat)) return false;
    return seat.status !== 'available';
  }

  getSeatClass(seat: EventSeat): string {
    if (this.isMySelection(seat)) return 'mine';
    if (seat.status === 'locked') return 'locked';
    if (seat.status === 'booked') return 'booked';
    return 'available';
  }

  getSeatTooltip(seat: EventSeat): string {
    if (this.isMyLock(seat)) {
      const cd = this.getCountdown(seat);
      return cd ? `Your seat — expires in ${cd}` : 'Your seat';
    }
    if (seat.status === 'locked') return 'Held by another user';
    if (seat.status === 'booked') return 'Already booked';
    return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
  }

  getCountdown(seat: EventSeat): string | null {
    if (!seat.locked_until) return null;
    const remaining = new Date(seat.locked_until).getTime() - Date.now();
    if (remaining <= 0) return null;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onSeatClick(seat: EventSeat) {
    if (this.readOnly) return;
    if (this.isMySelection(seat)) {
      this.deselect(seat);
    } else if (seat.status === 'available') {
      // Just add to local selection — NO immediate backend lock
      this.mySeats = [...this.mySeats, seat];
      this.selectionChanged.emit(this.mySeats);
      this.cdr.markForCheck();
    }
  }

  // Called externally (from event-detail) to reset selection after payment
  clearSelection() {
    this.mySeats = [];
    this.selectionChanged.emit([]);
    this.cdr.markForCheck();
  }

  deselect(seat: EventSeat) {
    this.mySeats = this.mySeats.filter(s => s.id !== seat.id);
    this.selectionChanged.emit(this.mySeats);
    this.cdr.markForCheck();
  }

  getRowIndex(label: string): number {
    return this.rows.findIndex(r => r.label === label);
  }

  private getStadiumLayoutConstants() {
    // Find max seats in any row to determine required circumference
    let maxSeatsInRow = 0;
    for (const row of this.rows) {
      if (row.seats.length > maxSeatsInRow) maxSeatsInRow = row.seats.length;
    }

    const seatWidth = 24; // Reduced from 32
    const minGap = 4;     // Reduced from 12
    const arcDegrees = 340; // Use more of the circle to pack seats tighter
    
    const minArcLength = (maxSeatsInRow + 1) * (seatWidth + minGap);
    const innerRadius = Math.max(120, (minArcLength * 360) / (2 * Math.PI * arcDegrees)); // Reduced min from 150
    
    const rowSpacing = 32; // Reduced from 44
    
    const pitchHeight = innerRadius * 0.8;
    const pitchWidth = pitchHeight * 0.5;

    const maxRadius = innerRadius + (this.rows.length * rowSpacing);
    const size = (maxRadius * 2) + 120; // Increased padding from 20 to 120
    const center = size / 2;

    return {
      innerRadius,
      rowSpacing,
      seatWidth,
      arcDegrees,
      startAngle: 100, 
      pitchWidth,
      pitchHeight,
      size,
      center
    };
  }

  getStadiumStyle(): Record<string, string> {
    const { size } = this.getStadiumLayoutConstants();
    return {
      width: `${size}px`,
      height: `${size}px`,
      position: 'relative'
    };
  }

  getPitchStyle(): Record<string, string> {
    const { pitchWidth, pitchHeight, center } = this.getStadiumLayoutConstants();
    return {
      width: `${pitchWidth}px`,
      height: `${pitchHeight}px`,
      borderRadius: '4px', // Rectangular with slight rounding
      left: `${center - (pitchWidth / 2)}px`,
      top: `${center - (pitchHeight / 2)}px`
    };
  }

  getGrassStyle(): Record<string, string> {
    const { innerRadius, center } = this.getStadiumLayoutConstants();
    const size = (innerRadius * 1.95); // Slightly smaller than first row
    return {
      width: `${size}px`,
      height: `${size}px`,
      left: `${center - (size / 2)}px`,
      top: `${center - (size / 2)}px`
    };
  }

  getSeatStyle(seatIndex: number, seatsInRow: number, rowIndex: number, totalRows: number): Record<string, string> {
    if (this.layoutType !== 'stadium') return {};

    const { innerRadius, rowSpacing, arcDegrees, startAngle, seatWidth, center } = this.getStadiumLayoutConstants();

    let angleDegrees = 0;
    if (seatsInRow <= 1) {
      angleDegrees = 270; // Top
    } else {
      const step = arcDegrees / (seatsInRow - 1);
      angleDegrees = startAngle + (seatIndex * step);
    }

    const angleRadians = angleDegrees * Math.PI / 180;
    const radius = innerRadius + (rowIndex * rowSpacing);

    const cx = center + radius * Math.cos(angleRadians);
    const cy = center + radius * Math.sin(angleRadians);

    // Rotate seat so top faces pitch
    const rotation = angleDegrees + 90;

    return {
      'position': 'absolute',
      'left': `${cx - (seatWidth / 2)}px`,
      'top': `${cy - (seatWidth / 2)}px`,
      'transform': `rotate(${rotation}deg)`
    };
  }
}
