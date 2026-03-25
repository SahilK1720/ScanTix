import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Ticket {
    id: string;
    order_id: string;
    event_id: string;
    seat_id: string | null;
    user_id: string;
    qr_code_data: string;
    ticket_type: 'standard' | 'vip';
    status: string;
    refund_status: 'none' | 'pending' | 'refunded';
    scanned_at: string | null;
    created_at: string;
    // Joined fields
    event_title?: string;
    event_date?: string;
    event_refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE';
    event_ticket_price?: string;
    event_vip_price?: string | null;
    event_status?: string;
    event_image?: string;
    event_location?: string;
    google_maps_url?: string;
}

export interface CancellationPreview {
    ticket_id: string;
    can_cancel: boolean;
    refundable: boolean;
    refund_amount: string;
    refund_status_after_cancel: 'none' | 'pending' | 'refunded';
    reason: string;
}

export interface CancellationResult {
    ticket_id: string;
    status: 'cancelled';
    refund_status: 'none' | 'pending' | 'refunded';
    refund_amount: string;
    message: string;
}

export interface TicketWithQr {
    ticket: Ticket;
    qr_image_base64: string;
    event_title: string;
    event_image: string | null;
    event_date: string;
    seat_label: string | null;
    event_status?: string;
}

export interface PurchaseRequest {
    event_id: string;
    quantity: number;
    ticket_type?: 'standard' | 'vip';
    seat_ids?: string[];
}

export interface ValidateResponse {
    valid: boolean;
    message: string;
    ticket_id: string | null;
    event_title: string | null;
    attendee_name: string | null;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
    constructor(private http: HttpClient) { }

    purchaseTickets(data: PurchaseRequest): Observable<Ticket[]> {
        return this.http.post<Ticket[]>(`${environment.apiUrl}/tickets/purchase`, data);
    }

    getMyTickets(): Observable<Ticket[]> {
        return this.http.get<Ticket[]>(`${environment.apiUrl}/tickets/my`);
    }

    getTicketQr(id: string): Observable<TicketWithQr> {
        return this.http.get<TicketWithQr>(`${environment.apiUrl}/tickets/${id}/qr?t=${Date.now()}`);
    }

    getCancellationPreview(id: string): Observable<CancellationPreview> {
        return this.http.get<CancellationPreview>(`${environment.apiUrl}/tickets/${id}/cancellation-preview`);
    }

    cancelTicket(id: string): Observable<CancellationResult> {
        return this.http.post<CancellationResult>(`${environment.apiUrl}/tickets/${id}/cancel`, {});
    }

    validateTicket(qrData: string): Observable<ValidateResponse> {
        return this.http.post<ValidateResponse>(`${environment.apiUrl}/validate`, {
            qr_data: qrData
        });
    }

    syncRefundStatus(id: string): Observable<CancellationResult> {
        return this.http.get<CancellationResult>(`${environment.apiUrl}/tickets/${id}/refund-status`);
    }
}
