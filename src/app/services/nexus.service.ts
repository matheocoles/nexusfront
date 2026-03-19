import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class NexusService {
  private readonly apiUrl = 'https://nexusapi.up.railway.app/api';
  private readonly http = inject(HttpClient);

  // ── GESTION DES HEADERS ──────────────────────────────────────────────────

  /** Génération centralisée des headers avec le Token JWT */
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

  // ── AUTHENTIFICATION & PROFIL ─────────────────────────────────────────────

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  saveSession(token: string, userId: string) {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user_id', userId);
  }

  logout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user_id');
  }

  getUserId(): string | null {
    return localStorage.getItem('nexus_user_id');
  }

  getUserProfile(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/logins/${id}`, { headers: this.getHeaders() });
  }

  // ── GESTION DES SESSIONS (EMPLOI DU TEMPS) ────────────────────────────────

  /** Récupère toutes les sessions (Schedule) */
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
    return this.http.delete(`${this.apiUrl}/sessions/${id}`, {
      headers: this.getHeaders(),
      body: {} // Nécessaire pour certains serveurs lors d'un DELETE
    });
  }

  // ── RESSOURCES LIÉES (CLASSES, SPORTS, ACTIVITÉS, ACHIEVEMENTS) ───────────

  /** GET /api/class — Liste des cours (matière, salle, prof...) */
  getClasses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/class`, { headers: this.getHeaders() });
  }

  /** GET /api/sport — Liste des sports (type, intensité, durée...) */
  getSports(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sport`, { headers: this.getHeaders() });
  }

  /** GET /api/extraactivity — Liste des activités extra-scolaires */
  getExtraActivities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/extraactivity`, { headers: this.getHeaders() });
  }

  /** GET /api/achievements — Liste de tous les trophées disponibles */
  getAchievements(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/achievements`, { headers: this.getHeaders() });
  }
  // ... dans NexusService
  getSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sessions`, { headers: this.getHeaders() });
  }
// ...
}
