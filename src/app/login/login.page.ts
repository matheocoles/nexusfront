import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonText,
  IonLoading, IonSpinner
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonText,
    IonLoading,
    IonSpinner
  ]
})
export class LoginPage {
  // Injections
  private http = inject(HttpClient);
  private router = inject(Router);

  // Modèles de données
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor() {}

  handleLogin() {
    // Validation simple
    if (!this.username || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const body = {
      username: this.username,
      password: this.password
    };

    // Note : On utilise /api/api/Login car ton proxy /api cible la racine
    // et ton swagger indique que la route commence par /api/
    this.http.post('/api/api/Login', body).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        // On sauvegarde le token (vérifie si ton API renvoie 'token' ou 'accessToken')
        const token = res.token || res.accessToken || res.jwt;

        if (token) {
          localStorage.setItem('nexus_token', token);
          // Navigation vers la page home des onglets
          this.router.navigate(['/tabs/home']);
        } else {
          this.errorMessage = "Erreur : Token non reçu par l'API.";
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error("Erreur de connexion :", err);

        if (err.status === 401) {
          this.errorMessage = "Identifiants incorrects.";
        } else if (err.status === 404) {
          this.errorMessage = "Route d'API introuvable (/api/api/Login).";
        } else {
          this.errorMessage = "Impossible de contacter le serveur Nexus.";
        }
      }
    });
  }
}
