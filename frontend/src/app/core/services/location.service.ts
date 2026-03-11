import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface LocationSuggestion {
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly apiUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  searchCities(query: string): Observable<LocationSuggestion[]> {
    const params = {
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '30', // Fetch even more to ensure we find the major city
      countrycodes: 'in',
      'accept-language': 'en'
    };

    return this.http.get<any[]>(this.apiUrl, { params }).pipe(
      map(results => {
        const mapped = results.map(res => {
          const addr = res.address;
          // In India, major cities are often listed under district or state_district
          const city = addr.city || addr.town || addr.city_district || addr.district || 
                       addr.state_district || addr.suburb || addr.municipality || addr.village;
          
          return {
            displayName: res.display_name,
            city: city,
            name: res.name || city,
            state: addr.state,
            country: addr.country,
            importance: res.importance || 0
          };
        });

        // Sorting strategy:
        // 1. Exact city match (highest priority)
        // 2. Prefix match on city
        // 3. API importance score
        // 4. Contains match
        return mapped.filter(m => m.city)
          .sort((a, b) => {
            const aLow = a.city!.toLowerCase();
            const bLow = b.city!.toLowerCase();
            const qLow = query.toLowerCase();

            // Exact matches first
            if (aLow === qLow && bLow !== qLow) return -1;
            if (bLow === qLow && aLow !== qLow) return 1;

            // Prefix matches second
            const aStarts = aLow.startsWith(qLow);
            const bStarts = bLow.startsWith(qLow);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            // Otherwise sort by API importance
            return (b as any).importance - (a as any).importance;
          })
          .filter((v, i, a) => a.findIndex(t => t.city === v.city) === i) // Deduplicate by city name
          .slice(0, 8); // Keep top 8 for UI
      })
    );
  }
}
