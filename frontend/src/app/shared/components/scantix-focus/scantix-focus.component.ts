import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  QueryList,
  ViewChildren,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ScanTixFocusComponent
 *
 * Applies a TrueFocus-style sequential character highlight to the "ScanTix" logo.
 * Each character is blurred except the currently focused one, which gets animated
 * corner-bracket "frame" that smoothly slides between characters.
 *
 * Usage:
 *   <app-scantix-focus></app-scantix-focus>
 *
 *   <!-- Manual hover mode with custom colours -->
 *   <app-scantix-focus
 *     [manualMode]="true"
 *     [blurAmount]="4"
 *     borderColor="#a78bfa"
 *     glowColor="rgba(167,139,250,0.5)"
 *   ></app-scantix-focus>
 */
@Component({
  selector: 'app-scantix-focus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stf-root" #container aria-label="PickMySeat">
      <span
        *ngFor="let part of parts; let i = index"
        #partEl
        class="stf-part"
        [ngClass]="{'part-gradient': i === 0}"
        [style.filter]="(currentIndex === parts.length || i === currentIndex) ? 'blur(0px)' : 'blur(' + blurAmount + 'px)'"
        [style.transition]="'filter ' + animationDuration + 's ease'"
        (mouseenter)="onMouseEnter(i)"
        (mouseleave)="onMouseLeave()"
      >{{ part }}</span>

      <!-- Animated corner-bracket focus frame -->
      <span
        *ngIf="focusRect"
        class="stf-frame"
        [style.transform]="'translate(' + focusRect.x + 'px, ' + focusRect.y + 'px)'"
        [style.width.px]="focusRect.width"
        [style.height.px]="focusRect.height"
        [style.transition]="'transform ' + animationDuration + 's cubic-bezier(0.4,0,0.2,1), width ' + animationDuration + 's cubic-bezier(0.4,0,0.2,1), height ' + animationDuration + 's cubic-bezier(0.4,0,0.2,1)'"
        [style.--stf-border-color]="borderColor"
        [style.--stf-glow-color]="glowColor"
        aria-hidden="true"
        (mouseenter)="onMouseEnter(parts.length)"
        (mouseleave)="onMouseLeave()"
      >
        <span class="stf-corner stf-tl"></span>
        <span class="stf-corner stf-tr"></span>
        <span class="stf-corner stf-bl"></span>
        <span class="stf-corner stf-br"></span>
      </span>
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    /* ── Container ─────────────────────────────────────────────────── */
    .stf-root {
      position: relative;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      isolation: isolate;
    }

    /* ── Individual part (word/syllable) ───────────────────────────── */
    .stf-part {
      display: inline-block;
      cursor: default;
      user-select: none;
      will-change: filter;
      position: relative;
      z-index: 1;
      color: #ffffff; /* Default to white for "My" and "Seats" */
    }

    /* ── Gradient modifier for "Pick" ──────────────────────────────── */
    .stf-part.part-gradient {
      /* Gradient text — must be on the leaf element, not a parent,
         because -webkit-text-fill-color:transparent only clips to itself */
      background: linear-gradient(135deg, #facc15 0%, #eab308 50%, #ca8a04 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ── Focus frame ───────────────────────────────────────────────── */
    .stf-frame {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 2;
      box-sizing: border-box;
      will-change: transform, width, height;
    }

    /* ── Corner pieces ─────────────────────────────────────────────── */
    .stf-corner {
      position: absolute;
      width: 8px;
      height: 8px;
      border-color: var(--stf-border-color, #4f8ef7);
      border-style: solid;
      filter: drop-shadow(0 0 4px var(--stf-glow-color, rgba(79, 142, 247, 0.6)));
    }

    .stf-tl {
      top: 0; left: 0;
      border-width: 2px 0 0 2px;
      border-radius: 2px 0 0 0;
    }
    .stf-tr {
      top: 0; right: 0;
      border-width: 2px 2px 0 0;
      border-radius: 0 2px 0 0;
    }
    .stf-bl {
      bottom: 0; left: 0;
      border-width: 0 0 2px 2px;
      border-radius: 0 0 0 2px;
    }
    .stf-br {
      bottom: 0; right: 0;
      border-width: 0 2px 2px 0;
      border-radius: 0 0 2px 0;
    }
  `],
})
export class ScanTixFocusComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Hover-to-focus mode instead of auto-cycling */
  @Input() manualMode = false;
  /** Blur applied to non-focused characters in pixels */
  @Input() blurAmount = 3;
  /** Corner bracket colour (any CSS colour string) */
  @Input() borderColor = '#4f8ef7';
  /** Glow / shadow colour for the bracket corners */
  @Input() glowColor = 'rgba(79, 142, 247, 0.6)';
  /** Duration of the focus-slide transition in seconds */
  @Input() animationDuration = 0.4;
  /** Pause between character changes in seconds */
  @Input() pauseBetweenAnimations = 0.5;

  readonly parts = ['Pick', 'My', 'Seats'];

  currentIndex = 0;
  focusRect: FocusRect | null = null;

  @ViewChild('container') private containerRef!: ElementRef<HTMLSpanElement>;
  @ViewChildren('partEl') private partEls!: QueryList<ElementRef<HTMLSpanElement>>;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    if (!this.manualMode) {
      this.startAutoCycle();
    }
  }

  ngAfterViewInit(): void {
    // Measure initial position after the view has rendered
    this.updateFocusRect();
  }

  ngOnDestroy(): void {
    this.clearInterval();
  }

  // ── Public interface ────────────────────────────────────────────────────────

  onMouseEnter(index: number): void {
    if (!this.manualMode) return;
    this.currentIndex = index;
    this.updateFocusRect();
    this.cdr.markForCheck();
  }

  onMouseLeave(): void {
    // Nothing to do in manual mode — keep last hovered character focused
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startAutoCycle(): void {
    const periodMs = (this.animationDuration + this.pauseBetweenAnimations) * 1000;

    // Run outside Angular zone so the interval doesn't trigger unnecessary
    // change-detection ticks — we do that manually via cdr.markForCheck().
    this.ngZone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        this.ngZone.run(() => {
          // Cycle from 0 to parts.length (where parts.length means "focus all")
          this.currentIndex = (this.currentIndex + 1) % (this.parts.length + 1);
          this.updateFocusRect();
          this.cdr.markForCheck();
        });
      }, periodMs);
    });
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateFocusRect(): void {
    const container = this.containerRef?.nativeElement;
    const partEls = this.partEls?.toArray();
    if (!container || !partEls || partEls.length === 0) return;

    const containerRect = container.getBoundingClientRect();

    if (this.currentIndex === this.parts.length) {
      // "Focus All" state — frame surrounds the entire word group
      // Add slight padding so it looks like a nice unified frame
      this.focusRect = {
        x: -4,
        y: -4,
        width: containerRect.width + 8,
        height: containerRect.height + 8,
      };
    } else {
      // Focus individual word parts
      const targetPart = partEls[this.currentIndex];
      if (!targetPart) return;
      
      const partRect = targetPart.nativeElement.getBoundingClientRect();
      this.focusRect = {
        x: partRect.left - containerRect.left,
        y: partRect.top - containerRect.top,
        width: partRect.width,
        height: partRect.height,
      };
    }
  }
}
