import { Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class NexusService {
  // L'URL de base sans slash final pour éviter les soucis de concaténation
  private apiUrl = 'https://nexusapi.up.railway.app/api';
  private readonly http = inject(HttpClient);

  // Génération des headers avec le token d'authentification
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('nexus_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      // On s'assure que le token est bien envoyé pour les routes sécurisées
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

  // Récupération du profil : cleanId gère le format "004" -> 4
  getUserProfile(id: string): Observable<any> {
    const cleanId = parseInt(id, 10);
    return this.http.get(`${this.apiUrl}/logins/${cleanId}`, { headers: this.getHeaders() });
  }

  // Récupération de l'emploi du temps
  getSchedule(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/activity`, { headers: this.getHeaders() });
  }

  // Création de session (C'est ici qu'on règle la 400 !)
  createSession(sessionData: any): Observable<any> {
    // On s'assure que l'URL est propre
    const url = `${this.apiUrl}/sessions`;

    // TRÈS IMPORTANT : On envoie les headers, sinon le serveur rejette la requête
    return this.http.post(url, sessionData, { headers: this.getHeaders() });
  }

  login(credentials: any): Observable<any> {
    // Le login ne nécessite pas de token Bearer
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  logout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user_id');
  }
}
