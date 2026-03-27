import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-decrypted-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="wrapper" [class]="parentClassName" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()" (click)="onClick()">
      <span class="sr-only">{{ text }}</span>
      <span aria-hidden="true">
        @for (char of currentTextChars; track $index; let idx = $index) {
          <span [class]="isRevealed(idx) ? className : encryptedClassName">{{ char }}</span>
        }
      </span>
    </span>
  `,
  styles: [`
    .wrapper {
      display: inline-block;
      white-space: pre-wrap;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      border: 0;
    }
  `]
})
export class DecryptedTextComponent implements OnInit, OnDestroy, OnChanges {
  @Input() text: string = '';
  @Input() speed: number = 50;
  @Input() maxIterations: number = 10;
  @Input() sequential: boolean = false;
  @Input() revealDirection: 'start' | 'end' | 'center' = 'start';
  @Input() useOriginalCharsOnly: boolean = false;
  @Input() characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';
  @Input() className: string = '';
  @Input() parentClassName: string = '';
  @Input() encryptedClassName: string = '';
  @Input() animateOn: 'hover' | 'click' | 'view' | 'inViewHover' = 'hover';
  @Input() clickMode: 'once' | 'toggle' = 'once';

  currentTextChars: string[] = [];
  revealedIndices: Set<number> = new Set();
  isAnimating: boolean = false;
  hasAnimated: boolean = false;
  isDecrypted: boolean = false;
  direction: 'forward' | 'reverse' = 'forward';

  private intervalRef: any;
  private observer: IntersectionObserver | null = null;
  private order: number[] = [];
  private pointer: number = 0;
  private currentIteration: number = 0;

  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isDecrypted = this.animateOn !== 'click';
    
    if (this.animateOn === 'click') {
      this.encryptInstantly();
    } else {
      this.currentTextChars = this.text.split('');
      this.isDecrypted = true;
    }
    
    this.revealedIndices = new Set();
    this.direction = 'forward';

    if (this.animateOn === 'view' || this.animateOn === 'inViewHover') {
      this.setupIntersectionObserver();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['text'] && !changes['text'].firstChange) {
      if (!this.isAnimating) {
        this.currentTextChars = this.text.split('');
        this.cdr.detectChanges();
      }
    }
  }

  ngOnDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    if (this.observer) this.observer.disconnect();
  }

  get availableChars(): string[] {
    if (this.useOriginalCharsOnly) {
      return Array.from(new Set(this.text.split(''))).filter(c => c !== ' ');
    }
    return this.characters.split('');
  }

  isRevealed(index: number): boolean {
    return this.revealedIndices.has(index) || (!this.isAnimating && this.isDecrypted);
  }

  shuffleText(originalText: string, currentRevealed: Set<number>): string[] {
    const chars = this.availableChars;
    return originalText.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (currentRevealed.has(i)) return originalText[i];
      return chars[Math.floor(Math.random() * chars.length)];
    });
  }

  computeOrder(len: number): number[] {
    const order: number[] = [];
    if (len <= 0) return order;
    if (this.revealDirection === 'start') {
      for (let i = 0; i < len; i++) order.push(i);
      return order;
    }
    if (this.revealDirection === 'end') {
      for (let i = len - 1; i >= 0; i--) order.push(i);
      return order;
    }
    const middle = Math.floor(len / 2);
    let offset = 0;
    while (order.length < len) {
      if (offset % 2 === 0) {
        const idx = middle + Math.floor(offset / 2);
        if (idx >= 0 && idx < len) order.push(idx);
      } else {
        const idx = middle - Math.ceil(offset / 2);
        if (idx >= 0 && idx < len) order.push(idx);
      }
      offset++;
    }
    return order.slice(0, len);
  }

  fillAllIndices(): Set<number> {
    const s = new Set<number>();
    for (let i = 0; i < this.text.length; i++) s.add(i);
    return s;
  }

  removeRandomIndices(set: Set<number>, count: number): Set<number> {
    const arr = Array.from(set);
    for (let i = 0; i < count && arr.length > 0; i++) {
      const idx = Math.floor(Math.random() * arr.length);
      arr.splice(idx, 1);
    }
    return new Set(arr);
  }

  encryptInstantly() {
    const emptySet = new Set<number>();
    this.revealedIndices = emptySet;
    this.currentTextChars = this.shuffleText(this.text, emptySet);
    this.isDecrypted = false;
  }

  triggerDecrypt() {
    if (this.sequential) {
      this.order = this.computeOrder(this.text.length);
      this.pointer = 0;
      this.revealedIndices = new Set();
    } else {
      this.revealedIndices = new Set();
    }
    this.direction = 'forward';
    this.isAnimating = true;
    this.currentIteration = 0;
    this.startAnimation();
  }

  triggerReverse() {
    if (this.sequential) {
      this.order = this.computeOrder(this.text.length).reverse();
      this.pointer = 0;
      this.revealedIndices = this.fillAllIndices();
      this.currentTextChars = this.shuffleText(this.text, this.fillAllIndices());
    } else {
      this.revealedIndices = this.fillAllIndices();
      this.currentTextChars = this.shuffleText(this.text, this.fillAllIndices());
    }
    this.direction = 'reverse';
    this.isAnimating = true;
    this.currentIteration = 0;
    this.startAnimation();
  }

  getNextIndex(revealedSet: Set<number>): number {
    const textLength = this.text.length;
    switch (this.revealDirection) {
      case 'start': return revealedSet.size;
      case 'end': return textLength - 1 - revealedSet.size;
      case 'center': {
        const middle = Math.floor(textLength / 2);
        const offset = Math.floor(revealedSet.size / 2);
        const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) return nextIndex;
        for (let i = 0; i < textLength; i++) { if (!revealedSet.has(i)) return i; }
        return 0;
      }
      default: return revealedSet.size;
    }
  }

  startAnimation() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    
    this.intervalRef = setInterval(() => {
      let nextRevealed = new Set(this.revealedIndices);
      
      if (this.sequential) {
        if (this.direction === 'forward') {
          if (nextRevealed.size < this.text.length) {
            const nextIndex = this.getNextIndex(nextRevealed);
            nextRevealed.add(nextIndex);
            this.currentTextChars = this.shuffleText(this.text, nextRevealed);
          } else {
            this.stopAnimation(true);
            return;
          }
        } else if (this.direction === 'reverse') {
          if (this.pointer < this.order.length) {
            const idxToRemove = this.order[this.pointer++];
            nextRevealed.delete(idxToRemove);
            this.currentTextChars = this.shuffleText(this.text, nextRevealed);
            if (nextRevealed.size === 0) {
              this.stopAnimation(false);
              return;
            }
          } else {
            this.stopAnimation(false);
            return;
          }
        }
      } else {
        if (this.direction === 'forward') {
          this.currentTextChars = this.shuffleText(this.text, nextRevealed);
          this.currentIteration++;
          if (this.currentIteration >= this.maxIterations) {
            this.currentTextChars = this.text.split('');
            this.stopAnimation(true);
            return;
          }
        } else if (this.direction === 'reverse') {
          let currentSet = nextRevealed;
          if (currentSet.size === 0) currentSet = this.fillAllIndices();
          const removeCount = Math.max(1, Math.ceil(this.text.length / Math.max(1, this.maxIterations)));
          nextRevealed = this.removeRandomIndices(currentSet, removeCount);
          this.currentTextChars = this.shuffleText(this.text, nextRevealed);
          this.currentIteration++;
          if (nextRevealed.size === 0 || this.currentIteration >= this.maxIterations) {
            this.currentTextChars = this.shuffleText(this.text, new Set());
            nextRevealed = new Set();
            this.stopAnimation(false);
            return;
          }
        }
      }
      
      this.revealedIndices = nextRevealed;
      this.cdr.detectChanges();
    }, this.speed);
  }

  stopAnimation(isDecrypted: boolean) {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.isAnimating = false;
    this.isDecrypted = isDecrypted;
    this.cdr.detectChanges();
  }

  // Event Handlers
  onMouseEnter() {
    if ((this.animateOn !== 'hover' && this.animateOn !== 'inViewHover') || this.isAnimating) return;
    this.revealedIndices = new Set();
    this.isDecrypted = false;
    this.currentTextChars = this.text.split('');
    this.direction = 'forward';
    this.isAnimating = true;
    this.startAnimation();
  }

  onMouseLeave() {
    if (this.animateOn !== 'hover' && this.animateOn !== 'inViewHover') return;
    this.stopAnimation(true);
    this.revealedIndices = new Set();
    this.currentTextChars = this.text.split('');
    this.direction = 'forward';
    this.cdr.detectChanges();
  }

  onClick() {
    if (this.animateOn !== 'click') return;
    if (this.clickMode === 'once') {
      if (this.isDecrypted) return;
      this.direction = 'forward';
      this.triggerDecrypt();
    } else if (this.clickMode === 'toggle') {
      if (this.isDecrypted) {
        this.triggerReverse();
      } else {
        this.direction = 'forward';
        this.triggerDecrypt();
      }
    }
  }

  private setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.hasAnimated) {
          this.triggerDecrypt();
          this.hasAnimated = true;
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.1 });

    if (this.el.nativeElement) {
      this.observer.observe(this.el.nativeElement);
    }
  }
}
