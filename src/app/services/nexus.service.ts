import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class NexusService {
  private apiUrl = 'https://nexusapi.up.railway.app/api';
  private readonly http = inject(HttpClient);

  saveSession(token: string, userId: string) {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user_id', userId);
  }

  getUserId(): string | null {
    return localStorage.getItem('nexus_user_id');
  }

  getUserProfile(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/logins/${id}`);
  }

  getSchedule(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/activity`);
  }

  createSession(sessionData: any): Observable<any> {
    const url = `${this.apiUrl}/sessions`.replace(/\/$/, "");
    return this.http.post(url, sessionData);
  }
}
