import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EventService, BankDetails, SaveBankDetailsPayload } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-bank-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="margin-bottom:32px; max-width:800px; margin-left:auto; margin-right:auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <h1>🏦 <span class="gradient-text">Bank Details</span></h1>
          @if (bankDetails?.is_verified) {
            <span class="badge badge-success" style="font-size:0.75rem">VERIFIED</span>
          } @else if (bankDetails) {
            <span class="" style="font-size:0.75rem"></span>
          }
        </div>
        <p>Manage your payout information for ticket sales revenue.</p>
      </div>

      <div class="glass-card" style="padding:32px;max-width:800px;margin:0 auto">
        <!-- Masked View -->
        @if (!isEditing && bankDetails) {
          <div style="display:flex;flex-direction:column;gap:24px">
            <div class="details-grid">
              <div class="detail-item">
                <label>Account Holder</label>
                <p>{{ bankDetails.account_holder_name }}</p>
              </div>
              <div class="detail-item">
                <label>Bank Name</label>
                <p>{{ bankDetails.bank_name }}</p>
              </div>
              <div class="detail-item">
                <label>Account Number</label>
                <p class="monospace">{{ bankDetails.account_number }}</p>
              </div>
              <div class="detail-item">
                <label>IFSC Code</label>
                <p class="monospace">{{ bankDetails.ifsc_code }}</p>
              </div>
              <div class="detail-item">
                <label>Account Type</label>
                <p style="text-transform:capitalize">{{ bankDetails.account_type }}</p>
              </div>
              @if (bankDetails.upi_id) {
                <div class="detail-item">
                  <label>UPI ID</label>
                  <p>{{ bankDetails.upi_id }}</p>
                </div>
              }
              @if (bankDetails.pan_number) {
                <div class="detail-item">
                  <label>PAN Number</label>
                  <p class="monospace">{{ bankDetails.pan_number }}</p>
                </div>
              }
            </div>
            
            <div style="display:flex;gap:12px;margin-top:16px">
              <button class="btn btn-primary" (click)="startEditing()">✏️ Edit Details</button>
            </div>
          </div>
        }

        <!-- Empty State / No Bank Details -->
        @if (!isEditing && !bankDetails && !loading) {
          <div style="text-align:center;padding:40px 0">
            <span style="font-size:3.5rem;display:block;margin-bottom:16px">🏦</span>
            <h2 style="margin-bottom:12px">No bank details yet</h2>
            <p style="color:var(--text-secondary);margin-bottom:24px;max-width:400px;margin-left:auto;margin-right:auto">
              You haven't added your payout information. Add it now to receive your ticket sales revenue.
            </p>
            <button class="btn btn-primary" (click)="isEditing = true">➕ Add Bank Details</button>
          </div>
        }

        <!-- Edit Form -->
        @if (isEditing) {
          <form [formGroup]="bankForm" (ngSubmit)="onSubmit()" class="animate-fadeIn">
            <div class="form-row">
              <div class="form-group">
                <label>Account Holder Name <span style="color:var(--danger)">*</span></label>
                <input class="form-control" formControlName="account_holder_name" placeholder="Name as per bank records" />
              </div>
              <div class="form-group">
                <label>Bank Name <span style="color:var(--danger)">*</span></label>
                <input class="form-control" formControlName="bank_name" placeholder="e.g. HDFC Bank, ICICI Bank" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Account Number <span style="color:var(--danger)">*</span></label>
                <input class="form-control" type="password" formControlName="account_number" placeholder="Enter full account number" />
                @if (bankForm.get('account_number')?.touched && bankForm.get('account_number')?.invalid) {
                  <p class="error-text">Min 8 characters required</p>
                }
              </div>
              <div class="form-group">
                <label>Confirm Account Number <span style="color:var(--danger)">*</span></label>
                <input class="form-control" formControlName="confirm_account_number" placeholder="Re-enter account number" />
                @if (bankForm.get('confirm_account_number')?.touched && formMismatch) {
                  <p class="error-text">Account numbers do not match</p>
                }
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>IFSC Code <span style="color:var(--danger)">*</span></label>
                <input class="form-control uppercase" formControlName="ifsc_code" placeholder="e.g. HDFC0001234" maxlength="11" />
                @if (bankForm.get('ifsc_code')?.touched && bankForm.get('ifsc_code')?.errors?.['pattern']) {
                  <p class="error-text">Invalid IFSC format (4 letters, 0, 6 alpha-numeric)</p>
                }
              </div>
              <div class="form-group">
                <label>Account Type <span style="color:var(--danger)">*</span></label>
                <select class="form-control" formControlName="account_type">
                  <option value="savings">Savings Account</option>
                  <option value="current">Current Account</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Branch Name (Optional)</label>
                <input class="form-control" formControlName="branch_name" placeholder="e.g. Mumbai Main Branch" />
              </div>
              <div class="form-group">
                <label>UPI ID (Optional)</label>
                <input class="form-control" formControlName="upi_id" placeholder="e.g. name@okhdfc" />
              </div>
            </div>

            <div class="form-group" style="max-width:300px">
              <label>PAN Number (Optional)</label>
              <input class="form-control uppercase" formControlName="pan_number" placeholder="ABCDE1234F" maxlength="10" />
              @if (bankForm.get('pan_number')?.touched && bankForm.get('pan_number')?.invalid) {
                <p class="error-text">Invalid PAN format (5 letters, 4 digits, 1 letter)</p>
              }
            </div>

            @if (errorMessage) {
              <div class="error-banner">{{ errorMessage }}</div>
            }

            @if (formMismatch) {
              <div class="error-banner">Account numbers do not match.</div>
            }

            <div style="display:flex;gap:12px;margin-top:32px;border-top:1px solid rgba(255,255,255,0.08);padding-top:24px">
              <button type="submit" class="btn btn-primary" [disabled]="submitting || bankForm.invalid">
                @if (submitting) { <span class="spinner-sm"></span> Saving... } 
                @else { Save Bank Details }
              </button>
              <button type="button" class="btn btn-secondary" (click)="cancelEditing()">Cancel</button>
            </div>
          </form>
        }
      </div>
      
      <div style="margin-top:24px;color:var(--text-muted);font-size:0.85rem;display:flex;align-items:center;gap:8px;justify-content:center;max-width:800px;margin-left:auto;margin-right:auto">
        <span style="font-size:1.1rem">🛡️</span>
        Your bank details are encrypted and stored securely. We only use them for payouts.
      </div>
    </div>
  `,
  styles: [`
    .details-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:24px; }
    .detail-item label { display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .detail-item p { font-size:1.05rem; font-weight:500; }
    .monospace { font-family:monospace; color:var(--info); }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
    @media (max-width:600px) { .form-row { grid-template-columns:1fr; } }
    .uppercase { text-transform:uppercase; }
    .error-text { color:var(--danger); font-size:0.75rem; margin-top:4px; }
    .error-banner { background:rgba(239,68,68,0.1); border:1px solid var(--danger); color:#fca5a5; padding:12px; border-radius:8px; margin-top:16px; font-size:0.9rem; }
    .spinner-sm { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `]
})
export class BankDetailsComponent implements OnInit {
  bankForm!: FormGroup;
  bankDetails: BankDetails | null = null;
  isEditing = false;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private cdr: ChangeDetectorRef,
    public auth: AuthService
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.fetchDetails();
  }

  initForm() {
    this.bankForm = this.fb.group({
      account_holder_name: ['', Validators.required],
      bank_name: ['', Validators.required],
      account_number: ['', [Validators.required, Validators.minLength(8)]],
      confirm_account_number: ['', Validators.required],
      ifsc_code: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
      branch_name: [''],
      upi_id: [''],
      pan_number: ['', Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)],
      account_type: ['savings', Validators.required]
    });
  }

  fetchDetails() {
    this.loading = true;
    this.eventService.getBankDetails().subscribe({
      next: details => {
        this.bankDetails = details;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startEditing() {
    this.isEditing = true;
    if (this.bankDetails) {
      this.bankForm.patchValue({
        account_holder_name: this.bankDetails.account_holder_name,
        bank_name: this.bankDetails.bank_name,
        account_number: '', // Don't pre-fill with masked number
        confirm_account_number: '',
        ifsc_code: this.bankDetails.ifsc_code,
        branch_name: this.bankDetails.branch_name,
        upi_id: this.bankDetails.upi_id,
        pan_number: this.bankDetails.pan_number,
        account_type: this.bankDetails.account_type
      });
    }
  }

  cancelEditing() {
    this.isEditing = false;
    this.errorMessage = '';
    this.bankForm.reset({ account_type: 'savings' });
  }

  get formMismatch() {
    const acc = this.bankForm.get('account_number')?.value;
    const conf = this.bankForm.get('confirm_account_number')?.value;
    return acc && conf && acc !== conf;
  }

  onSubmit() {
    this.bankForm.markAllAsTouched();
    if (this.bankForm.invalid || this.formMismatch) {
      this.errorMessage = 'Please fix the errors in the form before saving.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    
    const payload: SaveBankDetailsPayload = this.bankForm.value;
    
    const request = this.bankDetails ? 
      this.eventService.updateBankDetails(payload) : 
      this.eventService.createBankDetails(payload);

    request.subscribe({
      next: (res) => {
        this.bankDetails = res;
        this.isEditing = false;
        this.submitting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to save bank details. Please try again.';
        this.submitting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
