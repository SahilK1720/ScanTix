import { Component, Input, ChangeDetectionStrategy, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * ShinyTextComponent
 * 
 * Creates a sweeping metallic shine effect across text.
 * 
 * Props:
 *  - text {string} - The text content to display. Default: ""
 *  - disabled {boolean} - To disable the animation. Default: false
 *  - speed {number} - Animation speed in seconds. Default: 5
 *  - delay {number} - Animation delay in seconds. Default: 0
 *  - color {string} - Base color for the text. Default: "rgba(255, 255, 255, 0.7)"
 *  - shineColor {string} - Highlight color in the shine. Default: "#ffffff"
 *  - spread {number} - How spread out the shine gradient is. Default: 2.5
 *  - direction {"normal" | "reverse"} - Direction of the shine animation. Default: "normal"
 *  - yoyo {boolean} - If true, animation runs forwards then backwards. Default: false
 *  - pauseOnHover {boolean} - If true, the animation pauses when cursor is over the text. Default: true
 *  - className {string} - Additional CSS classes. Default: ""
 */
@Component({
  selector: 'app-shiny-text',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="shiny-text"
      [class.disabled]="disabled"
      [class.pause-on-hover]="pauseOnHover"
      [ngClass]="className"
      [style.--shiny-speed.s]="speed"
      [style.--shiny-delay.s]="delay"
      [style.--shiny-base-color]="color"
      [style.--shiny-highlight-color]="shineColor"
      [style.--shiny-spread]="spread"
      [style.--shiny-direction]="direction"
      [style.--shiny-iteration]="yoyo ? 'infinite alternate' : 'infinite'"
    >
      {{ text }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .shiny-text {
      /* Default CSS Variables (overridden by inline styles if inputs exist) */
      --shiny-speed: 5s;
      --shiny-delay: 0s;
      --shiny-base-color: rgba(255, 255, 255, 0.7);
      --shiny-highlight-color: #ffffff;
      --shiny-spread: 2.5;
      --shiny-direction: normal;
      --shiny-iteration: infinite;
      
      display: inline-block;
      white-space: nowrap;
      
      /* Background setup */
      background: linear-gradient(
        120deg,
        var(--shiny-base-color) calc(50% - (100% / var(--shiny-spread))),
        var(--shiny-highlight-color) 50%,
        var(--shiny-base-color) calc(50% + (100% / var(--shiny-spread)))
      );
      background-size: 200% auto;
      
      /* Clip text */
      color: transparent;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      
      /* Animation */
      animation: shine var(--shiny-speed) linear var(--shiny-delay) var(--shiny-iteration) var(--shiny-direction);
    }

    .shiny-text.disabled {
      animation: none;
      background: none;
      -webkit-background-clip: unset;
      background-clip: unset;
      color: var(--shiny-base-color);
      -webkit-text-fill-color: unset;
    }

    .shiny-text.pause-on-hover:hover {
      animation-play-state: paused;
    }

    @keyframes shine {
      to {
        background-position: 200% center;
      }
    }
  `]
})
export class ShinyTextComponent {
  @Input() text: string = '';
  @Input() disabled: boolean = false;
  @Input() speed: number = 5;
  @Input() delay: number = 0;
  @Input() color: string = 'rgba(255, 255, 255, 0.7)';
  @Input() shineColor: string = '#ffffff';
  @Input() spread: number = 2.5;
  @Input() direction: 'normal' | 'reverse' = 'normal';
  @Input() yoyo: boolean = false;
  @Input() pauseOnHover: boolean = true;
  @Input() className: string = '';
}
