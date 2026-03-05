import {inject, Injectable} from '@angular/core';
import { Observable } from 'rxjs';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class NexusService {
  private apiUrl = 'https://nexus-api-mocha.vercel.app';

  private readonly http = inject(HttpClient);

  // Exemple pour récupérer l'emploi du temps ou les stats
  getDashboardData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard`); // Adapte l'endpoint selon ton API
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }
}
