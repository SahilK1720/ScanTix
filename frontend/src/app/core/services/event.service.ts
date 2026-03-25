import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ScanEvent {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    venue_id: string | null;
    organizer_id: string;
    event_date: string;
    gate_open_time: string | null;
    event_end_time: string | null;
    ticket_price: string;
    vip_price: string | null;
    max_tickets: number;
    tickets_sold: number;
    status: string;
    seat_map_enabled: boolean;
    seat_rows: number | null;
    seat_columns: number | null;
    seat_layout: 'grid' | 'stadium';
    image_urls: string[];
    google_maps_url: string | null;
    refund_policy: 'REFUNDABLE' | 'NON_REFUNDABLE';
    created_at: string;
    updated_at: string;
}

export interface CreateEventPayload {
    title: string;
    description?: string;
    location?: string;
    venue_id?: string;
    event_date: string;
    gate_open_time?: string;
    event_end_time?: string;
    ticket_price: number;
    vip_price?: number;
    max_tickets: number;
    seat_map_enabled?: boolean;
    seat_rows?: number;
    seat_columns?: number;
    seat_layout?: 'grid' | 'stadium';
    image_urls?: string[];
    google_maps_url?: string;
    refund_policy: 'REFUNDABLE' | 'NON_REFUNDABLE';
}

export interface UpdateEventPayload {
    title?: string;
    description?: string;
    location?: string;
    event_date?: string;
    gate_open_time?: string;
    event_end_time?: string;
    ticket_price?: number;
    vip_price?: number;
    max_tickets?: number;
    status?: string;
    seat_layout?: 'grid' | 'stadium';
    image_urls?: string[];
    google_maps_url?: string;
    refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE';
}

export interface EventStats {
    event_id: string;
    title: string;
    tickets_sold: number;
    max_tickets: number;
    remaining: number;
    revenue: string;
    occupancy_pct: number;
    gross_sales: string;
    platform_commission: string;
    gateway_charges: string;
    net_earnings: string;
    avg_per_ticket: string;
    potential_revenue: string;
    vip_revenue: string;
    regular_revenue: string;
    vip_sold: number;
    vip_remaining: number;
    regular_sold: number;
    regular_remaining: number;
}

@Injectable({ providedIn: 'root' })
export class EventService {
    constructor(private http: HttpClient) { }

    getEvents(): Observable<ScanEvent[]> {
        return this.http.get<ScanEvent[]>(`${environment.apiUrl}/events`);
    }

    getEvent(id: string): Observable<ScanEvent> {
        return this.http.get<ScanEvent>(`${environment.apiUrl}/events/${id}`);
    }

    getMyEvents(): Observable<ScanEvent[]> {
        return this.http.get<ScanEvent[]>(`${environment.apiUrl}/events/my`);
    }

    getEventStats(id: string): Observable<EventStats> {
        return this.http.get<EventStats>(`${environment.apiUrl}/events/${id}/stats`);
    }

    createEvent(data: CreateEventPayload): Observable<ScanEvent> {
        return this.http.post<ScanEvent>(`${environment.apiUrl}/events`, data);
    }

    updateEvent(id: string, data: UpdateEventPayload): Observable<ScanEvent> {
        return this.http.put<ScanEvent>(`${environment.apiUrl}/events/${id}`, data);
    }

    deleteEvent(id: string): Observable<any> {
        return this.http.delete(`${environment.apiUrl}/events/${id}`);
    }

    uploadImages(id: string, files: File[]): Observable<ScanEvent> {
        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        return this.http.post<ScanEvent>(`${environment.apiUrl}/events/${id}/images`, formData);
    }
}
