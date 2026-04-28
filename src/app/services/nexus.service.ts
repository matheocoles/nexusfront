import { Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ToastController } from "@ionic/angular/standalone";

@Injectable({ providedIn: 'root' })
export class NexusService {
  private apiUrl = 'http://localhost:5032/api';
  private readonly http = inject(HttpClient);
  private toastController = inject(ToastController);

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('nexus_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  saveSession(token: string, userId: string) {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user_id', userId);
  }
  getUserId() { return localStorage.getItem('nexus_user_id'); }
  logout() { localStorage.clear(); location.reload(); }

  login(creds: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login`, creds);
  }

  getSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Sessions`, { headers: this.getHeaders() });
  }
  createSession(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Sessions`, data, { headers: this.getHeaders() });
  }
  updateSession(id: any, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Sessions/${id}`, data, { headers: this.getHeaders() });
  }
  deleteSession(id: any): Observable<any> {
    const token = localStorage.getItem('nexus_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.delete(`${this.apiUrl}/Sessions/${id}`, { headers });
  }

  getClasses(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/Class`, { headers: this.getHeaders() }); }
  getSports(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/Sport`, { headers: this.getHeaders() }); }
  getExtra(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/Extraactivity`, { headers: this.getHeaders() }); }
  getExtraActivities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/extraactivity`, { headers: this.getHeaders() });
  }

  getAchievements(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/achievements`, { headers: this.getHeaders() });
  }

  updateUser(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Logins/${id}`, data, { headers: this.getHeaders() });
  }

  async showToast(msg: string) {
    const toast = await this.toastController.create({
      message: `🚀 ${msg}`,
      duration: 2000,
      cssClass: 'nexus-toast-simple',
      position: 'bottom'
    });
    await toast.present();
  }
  createClass(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Class`, data, { headers: this.getHeaders() });
  }

  createSport(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Sport`, data, { headers: this.getHeaders() });
  }

  createExtra(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Extraactivity`, data, { headers: this.getHeaders() });
  }
}
