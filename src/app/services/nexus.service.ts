import { Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ToastController } from "@ionic/angular/standalone";

@Injectable({ providedIn: 'root' })
export class NexusService {
  // L'URL de base s'arrête à /api car le RoutePrefix du backend s'en occupe
  private apiUrl = 'http://localhost:5032/api';
  private readonly http = inject(HttpClient);
  private toastController = inject(ToastController);

  /**
   * Headers pour l'authentification JWT
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('nexus_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // --- AUTHENTIFICATION ---

  login(creds: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login`, creds);
  }

  logout(): void {
    localStorage.clear();
    location.reload();
  }

  // --- GESTION DES SESSIONS (EMPLOI DU TEMPS) ---

  getSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Sessions`, { headers: this.getHeaders() });
  }

  createSession(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Sessions`, data, { headers: this.getHeaders() });
  }

  updateSession(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Sessions/${id}`, data, { headers: this.getHeaders() });
  }

  deleteSession(id: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Sessions/${id}`, { headers: this.getHeaders() });
  }

  // --- GESTION DES CLASSES (COURS) ---

  getClasses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Class`, { headers: this.getHeaders() });
  }

  createClass(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Class`, data, { headers: this.getHeaders() });
  }

  updateClass(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Class/${id}`, data, { headers: this.getHeaders() });
  }

  // --- GESTION DES SPORTS ---

  getSports(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Sport`, { headers: this.getHeaders() });
  }

  createSport(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Sport`, data, { headers: this.getHeaders() });
  }

  updateSport(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Sport/${id}`, data, { headers: this.getHeaders() });
  }

  // --- GESTION DES ACTIVITÉS EXTRA ---

  getExtra(): Observable<any[]> {
    // Note : Vérifie si ton endpoint est "Extraactivity" ou "ExtraActivity" (sensible à la casse sous Linux)
    return this.http.get<any[]>(`${this.apiUrl}/Extraactivity`, { headers: this.getHeaders() });
  }

  createExtra(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Extraactivity`, data, { headers: this.getHeaders() });
  }

  updateExtra(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Extraactivity/${id}`, data, { headers: this.getHeaders() });
  }

  // --- UTILITAIRES ---

  async showToast(msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `🚀 ${msg}`,
      duration: 2000,
      position: 'bottom',
      cssClass: 'nexus-toast-simple'
    });
    await toast.present();
  }
}
