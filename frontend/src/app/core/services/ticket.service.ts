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
    scanned_at: string | null;
    created_at: string;
}

export interface TicketWithQr {
    ticket: Ticket;
    qr_image_base64: string;
    event_title: string;
    event_image: string | null;
    event_date: string;
    seat_label: string | null;
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
        return this.http.get<TicketWithQr>(`${environment.apiUrl}/tickets/${id}/qr`);
    }

    validateTicket(qrData: string): Observable<ValidateResponse> {
        return this.http.post<ValidateResponse>(`${environment.apiUrl}/validate`, {
            qr_data: qrData
        });
    }
}
