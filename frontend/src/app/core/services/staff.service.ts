import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EventStaff {
  id: string;
  event_id: string;
  organizer_id: string;
  name: string;
  email: string;
  phone_number: string;
  access_token: string;
  is_active: boolean;
  is_revoked: boolean;
  tickets_scanned: number;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddStaffRequest {
  name: string;
  email: string;
  phone_number: string;
}

export interface ScannerInfoResponse {
  event_id: string;
  event_name: string;
  event_date: string;
  daily_scan_count: number;
  staff_name: string;
}

export type ScanStatus = 'VALID_TICKET' | 'TICKET_ALREADY_SCANNED' | 'INVALID_TICKET';

export interface ScanResponse {
  status: ScanStatus;
  message: string;
  attendee_name?: string;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private http = inject(HttpClient);
  // Bypasses AuthInterceptor — used for public scanner endpoints
  private rawHttp = new HttpClient(inject(HttpBackend));

  private base = environment.apiUrl;

  // ── Organizer methods (go through AuthInterceptor) ──────────────────────

  listStaff(eventId: string): Observable<EventStaff[]> {
    return this.http.get<EventStaff[]>(`${this.base}/organizer/events/${eventId}/staff`);
  }

  addStaff(eventId: string, req: AddStaffRequest): Observable<EventStaff> {
    return this.http.post<EventStaff>(`${this.base}/organizer/events/${eventId}/staff`, req);
  }

  deleteStaff(eventId: string, staffId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/organizer/events/${eventId}/staff/${staffId}`);
  }

  revokeStaff(eventId: string, staffId: string): Observable<EventStaff> {
    return this.http.patch<EventStaff>(
      `${this.base}/organizer/events/${eventId}/staff/${staffId}/revoke`,
      {}
    );
  }

  restoreStaff(eventId: string, staffId: string): Observable<EventStaff> {
    return this.http.patch<EventStaff>(
      `${this.base}/organizer/events/${eventId}/staff/${staffId}/restore`,
      {}
    );
  }

  // ── Scanner methods (bypass AuthInterceptor via HttpBackend) ─────────────

  getScannerInfo(accessToken: string): Observable<ScannerInfoResponse> {
    return this.rawHttp.get<ScannerInfoResponse>(`${this.base}/scanner/${accessToken}`);
  }

  scanTicket(eventId: string, accessToken: string, qrData: string): Observable<ScanResponse> {
    return this.rawHttp.post<ScanResponse>(
      `${this.base}/organizer/events/${eventId}/staff/scanner/${accessToken}/scan`,
      { qr_data: qrData }
    );
  }
}
