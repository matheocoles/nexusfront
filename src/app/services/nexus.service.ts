import { Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class NexusService {
  private apiUrl = 'https://nexusapi.up.railway.app/api';
  private readonly http = inject(HttpClient);

  // Génération centralisée des headers avec Token
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('nexus_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  saveSession(token: string, userId: string) {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user_id', userId);
  }

  getUserId(): string | null {
    return localStorage.getItem('nexus_user_id');
  }

  getUserProfile(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/logins/${id}`, { headers: this.getHeaders() });
  }

  getSchedule(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sessions`, { headers: this.getHeaders() });
  }

  createSession(sessionData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/sessions`, sessionData, { headers: this.getHeaders() });
  }

  updateSession(id: number | string, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/sessions/${id}`, payload, { headers: this.getHeaders() });
  }

  deleteSession(id: number | string): Observable<any> {
    const url = `${this.apiUrl}/sessions/${id}`;

    const options = {
      headers: this.getHeaders(),
      body: { id: id }
    };

    return this.http.delete(url, options);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  logout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user_id');
  }
}
