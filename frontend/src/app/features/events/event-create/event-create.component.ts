import { Component, ChangeDetectorRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Subject, debounceTime, distinctUntilChanged, switchMap, tap, of } from 'rxjs';
import { EventService, CreateEventPayload } from '../../../core/services/event.service';
import { SeatService } from '../../../core/services/seat.service';
import { LocationService, LocationSuggestion } from '../../../core/services/location.service';
import { ImageCropperComponent, CroppedEvent } from '../../../shared/image-cropper/image-cropper.component';

@Component({
  selector: 'app-event-create',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageCropperComponent],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="text-align: center; margin-bottom: 32px;">
        <h1>➕ <span class="gradient-text">Create Event</span></h1>
        <p>Set up your event details and start selling tickets</p>
      </div>

      <div class="glass-card" style="padding:40px;max-width:760px;margin: 0 auto;">
        @if (error) { <div class="alert alert-danger">{{ error }}</div> }

        <form #eventForm="ngForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Event Title *</label>
            <input class="form-control" [(ngModel)]="title" name="title" placeholder="e.g. TechX Summit, Sufi Under the Stars" required>
          </div>

          <div class="form-group">
            <label>Description *</label>
            <textarea class="form-control" [(ngModel)]="description" name="description"
                      placeholder="Tell attendees what makes this event special — vibe, experience, highlights, and why they should come." rows="4" required></textarea>
          </div>

          <div class="form-group" style="position:relative">
            <label>📍 Location *</label>
            <input class="form-control" [(ngModel)]="location" name="location"
                   placeholder="e.g. Phoenix Marketcity, Pune • JW Marriott, Mumbai • Open Air Arena, Delhi" required
                   (ngModelChange)="onLocationInput($event)" autocomplete="off">
            
            @if (isSearchingLocation) {
              <div class="location-spinner"></div>
            }

            @if (locationSuggestions.length > 0) {
              <div class="location-suggestions-dropdown glass-card">
                @for (sugg of locationSuggestions; track sugg.displayName) {
                  <div class="suggestion-item" (click)="selectLocation(sugg)">
                    <div class="suggestion-name">{{ sugg.city || sugg.displayName }}</div>
                    <div class="suggestion-details">{{ sugg.displayName }}</div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="form-group">
            <label>📸 Event Photos (Up to 5) *</label>
            <div class="custom-file-input">
              <button type="button" class="btn-file-select" (click)="fileInput.click()">Choose Files</button>
              <span class="file-name-label">
                {{ selectedFiles.length === 0 ? 'No file chosen' : selectedFiles.length + ' file(s) chosen' }}
              </span>
              <input #fileInput type="file" style="display:none" multiple accept="image/*" (change)="onFilesSelected($event)">
            </div>
            <small class="form-hint">Select up to 5 images from your device. The first image will be your cover photo.</small>
          </div>

          @if (selectedFiles.length > 0) {
            <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
              @for (file of selectedFiles; track file.name; let i = $index) {
                <div style="position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
                  <img [src]="filePreviewUrls[i]" style="width:100%;height:100%;object-fit:cover">
                  <button type="button" (click)="removeFile(i)" 
                          style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:50%;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px">✕</button>
                  @if (i === 0) {
                    <span style="position:absolute;bottom:0;left:0;right:0;background:rgba(234,179,8,0.8);color:#000;font-weight:600;font-size:10px;text-align:center;padding:2px 0">COVER</span>
                  }
                </div>
              }
            </div>
          }

          <!-- Custom Canvas Image Cropper Modal -->
          @if (imageFile) {
            <app-image-cropper
              [imageFile]="imageFile"
              [aspectRatio]="16/9"
              (imageCropped)="onImageCropped($event)"
              (cropCanceled)="cancelCrop()">
            </app-image-cropper>
          }

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div class="form-group">
              <label>Event Date & Time *</label>
              <input type="datetime-local" class="form-control" [(ngModel)]="eventDate" name="event_date" 
                     [min]="minDateTime" required>
            </div>
            <div class="form-group">
              <label>Max Tickets *</label>
              <input type="text" class="form-control" [(ngModel)]="maxTickets" name="max_tickets"
                     placeholder="500" [disabled]="seatMapEnabled" 
                     (input)="enforceNumeric($event)" required>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div class="form-group">
              <label>🚪 Gate Opens At *</label>
              <input type="datetime-local" class="form-control" [(ngModel)]="gateOpenTime" name="gate_open_time"
                     [max]="eventDate" required>
              <small class="form-hint">When gates open for attendees</small>
            </div>
            <div class="form-group">
              <label>🏁 Event Ends At *</label>
              <input type="datetime-local" class="form-control" [(ngModel)]="eventEndTime" name="event_end_time"
                     [min]="eventDate" required>
              <small class="form-hint">When the event officially ends</small>
            </div>
          </div>

          <div class="form-group">
            <label>🗺️ Google Maps Venue Link *</label>
            <input type="url" class="form-control" [(ngModel)]="googleMapsUrl" name="google_maps_url"
                   placeholder="https://maps.google.com/?q=..." required>
            <small class="form-hint">Paste the Google Maps link of the venue</small>
            @if (googleMapsUrl && !isValidMapsUrl(googleMapsUrl)) {
              <span style="color:var(--danger);font-size:0.78rem">Please enter a valid URL (must start with http)</span>
            }
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div class="form-group">
              <label>Ticket Price (₹) *</label>
              <input type="text" class="form-control" [(ngModel)]="ticketPrice"
                     name="ticket_price" placeholder="25.00" 
                     (input)="enforceDecimal($event)" required>
            </div>
            <div class="form-group">
              <label>VIP Price (₹) *</label>
              <input type="text" class="form-control" [(ngModel)]="vipPrice"
                     name="vip_price" placeholder="75.00" 
                     (input)="enforceDecimal($event)" required>
            </div>
          </div>

          <div class="form-group">
            <label>Refund Policy *</label>
            <div class="custom-select-wrapper">
              <select class="form-control custom-select" [(ngModel)]="refundPolicy" name="refund_policy" required>
                <option value="NON_REFUNDABLE">🔒 Non-Refundable</option>
                <option value="REFUNDABLE">💸 Refundable (– 24h)</option>
              </select>
            </div>
            <small class="form-hint" style="margin-top:8px; display:block;">
              Refunds are only eligible when ticket cancellation happens at least 24 hours before event start.
            </small>
          </div>

          <!-- ── Seat Layout Toggle ────────────────────────────────────── -->
          <div class="seat-toggle-card">
            <div class="seat-toggle-header" (click)="toggleSeatMap()">
              <div>
                <div class="seat-toggle-title">🪑 Enable Seat Layout</div>
                <div class="seat-toggle-sub">
                  Let attendees pick specific seats from a visual map
                </div>
              </div>
              <label class="toggle-switch" (click)="$event.stopPropagation()">
                <input type="checkbox" [(ngModel)]="seatMapEnabled" name="seat_map_enabled"
                       (change)="onSeatMapToggle()">
                <span class="slider"></span>
              </label>
            </div>

            @if (seatMapEnabled) {
              <div class="seat-config">
                <div class="form-group" style="margin-bottom:16px">
                  <label>Layout Style</label>
                  <div style="display:flex;gap:16px;margin-top:8px">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                      <input type="radio" name="seat_layout" [(ngModel)]="seatLayout" value="grid"> Grid View
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                      <input type="radio" name="seat_layout" [(ngModel)]="seatLayout" value="stadium"> Stadium View
                    </label>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                  <div class="form-group" style="margin-bottom:0">
                    <label>Rows (A–Z) *</label>
                    <input type="number" class="form-control"
                           [(ngModel)]="seatRows" name="seat_rows"
                           placeholder="10" min="1" max="500"
                           (ngModelChange)="recalcTotal()">
                    <small class="form-hint">Max 500 rows (A–Z, AA, AB...)</small>
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label>Seats per Row *</label>
                    <input type="number" class="form-control"
                           [(ngModel)]="seatColumns" name="seat_columns"
                           placeholder="20" min="1" max="100"
                           (ngModelChange)="recalcTotal()">
                    <small class="form-hint">Max 100 per row</small>
                  </div>
                </div>

                @if (seatRows && seatColumns) {
                  <div class="seat-preview">
                    <span>
                      Generates
                      <strong>{{ rowRangeLabel }}</strong> ×
                      <strong>1–{{ seatColumns }}</strong> =
                      <strong>{{ totalSeats }} seats</strong>
                    </span>
                  </div>

                  <!-- Mini visual preview -->
                  <!-- Mini visual preview -->
                  <div class="mini-map-wrapper">
                    @if (seatLayout === 'grid') {
                      <div class="mini-map">
                        <div class="mini-rows-container">
                          @for (r of previewRows; track r; let i = $index) {
                            <div class="mini-row">
                              <span class="mini-label">{{ r }}</span>
                              @for (c of previewCols; track c) {
                                <span class="mini-seat"></span>
                              }
                              @if (seatColumns > 8) {
                                <span class="mini-ellipsis">…</span>
                              }
                            </div>
                          }
                        </div>
                        @if (seatRows > 5) {
                          <div class="mini-more">+ {{ seatRows - 5 }} more row(s)</div>
                        }
                      </div>
                    } @else {
                      <div class="mini-stadium-container">
                        <div class="mini-pitch">PITCH</div>
                        @for (r of previewRows; track r; let rIdx = $index) {
                          @for (c of previewCols; track c; let cIdx = $index) {
                            <div class="stadium-mini-seat" [ngStyle]="getMiniStadiumSeatStyle(rIdx, cIdx, previewCols.length)"></div>
                          }
                        }
                      </div>
                      @if (seatRows > 5 || seatColumns > 8) {
                        <div class="mini-more">+ more seats hidden in preview</div>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>
          <!-- ──────────────────────────────────────────────────────────── -->
          
          @if (!loading && !eventForm.valid && eventForm.touched) {
            <div class="validation-alert" style="margin-top:24px; margin-bottom:-12px; font-weight:600;">
              <span style="font-size:1.2rem">⚠️</span>
              <span>Please fill all required fields correctly.</span>
            </div>
          }

          <div style="display:flex;gap:12px;margin-top:24px">
            <button type="submit" class="btn btn-primary btn-lg" 
                    [disabled]="loading || !eventForm.valid || (seatMapEnabled && (!seatRows || !seatColumns || seatRows > 500 || seatColumns > 100)) || selectedFiles.length === 0">
              @if (loading) {
                <span class="spinner" style="width:18px;height:18px;border-width:2px"></span>
              } @else { 🚀 Create Event }
            </button>
            @if (seatMapEnabled && seatRows && seatRows > 500) {
              <div style="color:#ef4444;font-size:0.85rem;margin-top:8px">Maximum 500 rows allowed.</div>
            }
            <button type="button" class="btn btn-secondary btn-lg" (click)="cancel()">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    button:disabled {
      background: #374151 !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
      opacity: 0.8;
      border-color: #4b5563 !important;
    }
    .seat-toggle-card {
      border:1px solid rgba(234,179,8,.3); border-radius:12px;
      overflow:hidden; margin-top:8px;
    }
    .seat-toggle-header {
      padding:16px 20px; display:flex; justify-content:space-between; align-items:center;
      background:rgba(234,179,8,.05); transition:background .2s;
      cursor:pointer; user-select:none;
    }
    .seat-toggle-header:hover { background:rgba(234,179,8,.1); }
    .seat-toggle-title { font-weight:600; font-size:1.1rem; color:var(--text-primary); margin-bottom:4px; }
    .seat-toggle-sub { font-size:.85rem; color:var(--text-muted); }

    .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
    .toggle-switch input { opacity:0; width:0; height:0; }
    .slider {
      position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
      background-color:rgba(255,255,255,.1); transition:.4s; border-radius:24px;
    }
    .slider::before {
      position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px;
      background-color:white; transition:.4s; border-radius:50%;
    }
    input:checked + .slider { background:var(--accent-primary,#eab308); }
    input:checked + .slider::before { transform:translateX(20px); }

    .seat-config { padding:20px; border-top:1px solid rgba(234,179,8,.2); }
    .form-hint { font-size:.75rem; color:var(--text-muted); margin-top:4px; display:block; }

    .seat-preview {
      display:flex; align-items:center; justify-content:center; padding:12px 16px;
      background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.25);
      border-radius:8px; margin-top:16px; font-size:.9rem; color:var(--text-secondary); text-align:center;
    }

    .mini-map { margin-top:14px; display:flex; flex-direction:column; gap:4px; align-items:center; }
    .mini-rows-container { display:flex; flex-direction:column; gap:4px; width:100%; align-items:center; }
    .mini-row { display: flex; gap: 4px; align-items: center; justify-content: center; width: 100%; }
    .mini-label { font-size: 0.65rem; color: var(--text-muted); width: 14px; text-align: right; }
    .mini-seat { width: 10px; height: 10px; background: rgba(56, 189, 248, 0.4); border-radius: 2px; }
    .mini-ellipsis { font-size: 0.7rem; color: var(--text-muted); letter-spacing: 1px; margin-left: 4px; }
    .mini-more { text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 8px; font-style: italic; }

    /* Circular Stadium-specific mini preview */
    .mini-stadium-container {
      position: relative;
      width: 140px;
      height: 140px;
      margin: 10px auto;
      border-radius: 50%;
      background: rgba(34,197,94,.1);
    }
    .mini-pitch {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 25px; height: 50px;
      background: rgba(202, 92, 24, 0.4);
      border: 1px solid rgba(202, 92, 24, 0.6);
      font-size: 0.4rem; color: #fef3c7;
      display: flex; align-items: center; justify-content: center;
      writing-mode: vertical-lr; text-orientation: upright;
      letter-spacing: 1px;
    }
    .stadium-mini-seat {
      position: absolute;
      width: 6px; height: 6px;
      background: rgba(56, 189, 248, 0.5);
      border-radius: 2px 2px 0 0;
      top: 50%; left: 50%;
      margin-left: -3px; margin-top: -3px;
    }
    
    .custom-file-input {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-md);
      transition: border-color 0.2s;
    }
    .custom-file-input:hover { border-color: rgba(234, 179, 8, 0.4); }
    .btn-file-select {
      background: #374151;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-file-select:hover { background: #4b5563; }
    .file-name-label { font-size: 0.9rem; color: var(--text-secondary); }

    .location-suggestions-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      margin-top: 4px;
      padding: 8px 0;
      max-height: 240px;
      overflow-y: auto;
      background: #18181b;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .custom-select-wrapper { 
      position: relative; 
      margin-top: 8px;
    }
    .custom-select-wrapper::after {
      content: "▼";
      font-size: 0.8rem;
      color: var(--text-muted);
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .custom-select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-color: rgba(15, 23, 42, 0.4);
      border: 1px solid var(--border-glass);
      color: var(--text-primary);
      padding: 12px 40px 12px 14px;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      height: 48px;
    }
    .custom-select:focus, .custom-select:hover {
      border-color: rgba(56, 189, 248, 0.5);
      background-color: rgba(15, 23, 42, 0.7);
    }
    .custom-select option {
      background: #1e293b;
      color: #f8fafc;
      padding: 12px;
    }
    .suggestion-item {
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .suggestion-item:hover {
      background: rgba(255,255,255,0.05);
    }
    .suggestion-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-primary);
    }
    .suggestion-details {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .location-spinner {
      position: absolute;
      right: 12px;
      top: 42px;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `]
})
export class EventCreateComponent implements OnInit {
  title = '';
  description = '';
  location = '';
  eventDate = '';
  gateOpenTime = '';
  eventEndTime = '';
  googleMapsUrl = '';
  maxTickets: number | null = null;
  ticketPrice: number | null = null;
  vipPrice: number | null = null;
  refundPolicy: 'REFUNDABLE' | 'NON_REFUNDABLE' = 'NON_REFUNDABLE';
  loading = false;
  error = '';

  // Seat map
  seatMapEnabled = false;
  seatLayout: 'grid' | 'stadium' = 'grid';
  seatRows: number | null = null;
  seatColumns: number | null = null;
  totalSeats = 0;
  rowRangeLabel = '';
  previewRows: string[] = [];
  previewCols: number[] = [];

  // File Uploads & Cropping
  selectedFiles: File[] = [];
  filePreviewUrls: string[] = [];
  
  // Multiple files cropping queue
  pendingFilesToCrop: File[] = [];
  imageFile: File | null = null;
  croppedImage: string = '';
  currentProcessingFileName: string = '';

  // Date constraints
  minDateTime = '';

  constructor(
    private eventService: EventService,
    private seatService: SeatService,
    private locationService: LocationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  // Location suggestions
  private locationSearch$ = new Subject<string>();
  locationSuggestions: LocationSuggestion[] = [];
  isSearchingLocation = false;

  ngOnInit() {
    // Set minDateTime to now (in current timezone format YYYY-MM-DDThh:mm)
    const now = new Date();
    // Adjust for local timezone offset
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.minDateTime = now.toISOString().slice(0, 16);

    // Setup location search
    this.locationSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          this.locationSuggestions = [];
          return of([]);
        }
        this.isSearchingLocation = true;
        this.cdr.detectChanges();
        return this.locationService.searchCities(query).pipe(
          finalize(() => {
            this.isSearchingLocation = false;
            this.cdr.detectChanges();
          })
        );
      })
    ).subscribe(suggestions => {
      this.locationSuggestions = suggestions;
      this.cdr.detectChanges();
    });
  }

  enforceNumeric(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
    this.maxTickets = input.value ? parseInt(input.value, 10) : null;
  }

  enforceDecimal(event: Event) {
    const input = event.target as HTMLInputElement;
    // Allow digits and a single optional decimal point
    let val = input.value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point exists
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    input.value = val;

    if (input.name === 'ticket_price') {
      this.ticketPrice = val ? parseFloat(val) : null;
    } else if (input.name === 'vip_price') {
      this.vipPrice = val ? parseFloat(val) : null;
    }
  }

  onLocationInput(query: string) {
    this.locationSearch$.next(query);
  }

  selectLocation(suggestion: LocationSuggestion) {
    this.location = suggestion.displayName;
    this.locationSuggestions = [];
    this.locationSearch$.next('');
    this.cdr.detectChanges();
  }

  toggleSeatMap() {
    this.seatMapEnabled = !this.seatMapEnabled;
    this.onSeatMapToggle();
  }

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    // We allow multi-select, but we will crop them one by one.
    const newFiles = Array.from(files);
    const availableSlots = 5 - this.selectedFiles.length;
    
    if (newFiles.length > availableSlots) {
      this.error = 'You can only upload a maximum of 5 images.';
      // Take only what fits
      this.pendingFilesToCrop = newFiles.slice(0, availableSlots);
    } else {
      this.error = '';
      this.pendingFilesToCrop = newFiles;
    }

    if (this.pendingFilesToCrop.length > 0) {
      this.processNextFileForCropping();
    }

    // Reset file input so same file can be selected again if removed
    event.target.value = '';
  }

  processNextFileForCropping() {
    if (this.pendingFilesToCrop.length === 0) {
      this.imageFile = null;
      return;
    }

    const fileToCrop = this.pendingFilesToCrop.shift()!;
    this.currentProcessingFileName = fileToCrop.name;
    
    // Pass the raw File object directly to ngx-image-cropper
    this.imageFile = fileToCrop;
  }

  onImageCropped(event: CroppedEvent) {
    // Determine the original extension to keep it consistent
    const ext = this.currentProcessingFileName.split('.').pop() || 'jpg';
    const baseName = this.currentProcessingFileName.substring(0, this.currentProcessingFileName.lastIndexOf('.'));
    const newFilename = `${baseName}_cropped.${ext}`;
    
    // Convert Blob back to File
    const file = new File([event.blob], newFilename, { type: 'image/jpeg' });
    
    this.selectedFiles.push(file);
    this.filePreviewUrls.push(event.objectUrl);
    
    this.imageFile = null;
    this.processNextFileForCropping(); // Move to next file
  }

  cancelCrop() {
    this.imageFile = null;
    this.processNextFileForCropping(); // Move to next file in queue
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    URL.revokeObjectURL(this.filePreviewUrls[index]);
    this.filePreviewUrls.splice(index, 1);
  }

  onSeatMapToggle() {
    if (this.seatMapEnabled) {
      this.recalcTotal();
    } else {
      this.totalSeats = 0;
    }
  }

  recalcTotal() {
    const r = this.seatRows ?? 0;
    const c = this.seatColumns ?? 0;
    this.totalSeats = r * c;

    // Helper to generate labels: 0 -> A, 25 -> Z, 26 -> AA...
    const getLabel = (index: number) => {
      let n = index;
      let label = '';
      while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
      }
      return label;
    };

    // Row label range e.g. "A–J"
    const first = getLabel(0);
    const last = r > 0 ? getLabel(r - 1) : '';
    this.rowRangeLabel = r > 0 ? `${first}–${last}` : '';

    // Update max_tickets to match seat total
    if (this.seatMapEnabled && this.totalSeats > 0) {
      this.maxTickets = this.totalSeats;
    }

    // Preview grid (max 5 rows, 8 cols)
    const pRows = Math.min(r, 5);
    const pCols = Math.min(c, 8);
    this.previewRows = Array.from({ length: pRows }, (_, i) => String.fromCharCode(65 + i));
    this.previewCols = Array.from({ length: pCols }, (_, i) => i + 1);
  }

  isValidMapsUrl(url: string): boolean {
    return url.startsWith('http');
  }

  getMiniStadiumSeatStyle(rowIndex: number, colIndex: number, totalCols: number) {
    // Determine the distance from the center for this row
    const radius = 35 + (rowIndex * 8);
    let angle = 0;
    // Spread seats across an arc
    if (totalCols > 1) {
      const startAngle = -160;
      const step = 320 / (totalCols - 1);
      angle = startAngle + (colIndex * step);
    }
    return {
      'transform': `translate(-50%, -50%) rotate(${angle}deg) translateY(${-radius}px)`
    };
  }

  onSubmit() {
    if (this.seatMapEnabled) {
      if (!this.seatRows || this.seatRows < 1 || this.seatRows > 500) {
        this.error = 'Rows must be between 1 and 500.';
        return;
      }
      if (!this.seatColumns || this.seatColumns < 1 || this.seatColumns > 100) {
        this.error = 'Seats per row must be between 1 and 100.';
        return;
      }
    }

    const selectedDate = new Date(this.eventDate);
    if (selectedDate < new Date()) {
      this.error = 'Event date and time must be in the future.';
      return;
    }

    if (!this.googleMapsUrl || !this.isValidMapsUrl(this.googleMapsUrl)) {
      this.error = 'Google Maps URL is required and must be a valid URL starting with http.';
      return;
    }

    if (!this.gateOpenTime) {
      this.error = 'Gate open time is required.';
      return;
    } else {
      const gateDate = new Date(this.gateOpenTime);
      if (gateDate > selectedDate) {
        this.error = 'Gate open time must be before or equal to event start time.';
        return;
      }
    }

    if (!this.eventEndTime) {
      this.error = 'Event end time is required.';
      return;
    } else {
      const endDate = new Date(this.eventEndTime);
      if (endDate <= selectedDate) {
        this.error = 'Event end time must be after event start time.';
        return;
      }
    }

    this.loading = true;
    this.error = '';

    const payload: CreateEventPayload = {
      title: this.title,
      description: this.description || undefined,
      location: this.location || undefined,
      event_date: selectedDate.toISOString(),
      gate_open_time: this.gateOpenTime ? new Date(this.gateOpenTime).toISOString() : undefined,
      event_end_time: this.eventEndTime ? new Date(this.eventEndTime).toISOString() : undefined,
      google_maps_url: this.googleMapsUrl || undefined,
      max_tickets: this.maxTickets!,
      ticket_price: this.ticketPrice!,
      vip_price: this.vipPrice || undefined,
      seat_map_enabled: this.seatMapEnabled || undefined,
      seat_rows: this.seatMapEnabled ? this.seatRows! : undefined,
      seat_columns: this.seatMapEnabled ? this.seatColumns! : undefined,
      seat_layout: this.seatMapEnabled ? this.seatLayout : undefined,
      refund_policy: this.refundPolicy,
    };

    this.eventService.createEvent(payload).subscribe({
      next: (event) => {
        // After event created, upload images if any exist
        const continueFlow = () => {
          if (this.seatMapEnabled) {
            this.seatService.generateSeats(event.id).pipe(
              finalize(() => { this.loading = false; this.router.navigate(['/events', event.id]); })
            ).subscribe({ error: () => { this.router.navigate(['/events', event.id]); } });
          } else {
            this.loading = false;
            this.router.navigate(['/events', event.id]);
          }
        };

        if (this.selectedFiles.length > 0) {
          this.eventService.uploadImages(event.id, this.selectedFiles).subscribe({
            next: () => continueFlow(),
            error: (err) => {
              this.error = 'Event created, but images failed to upload: ' + (err.error?.message || err.message);
              // Still continue to event since it was successfully created
              setTimeout(() => continueFlow(), 2000);
            }
          });
        } else {
          continueFlow();
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.message || `Failed to create event (${err.status}).`;
      }
    });
  }

  cancel() { this.router.navigate(['/events']); }
}
