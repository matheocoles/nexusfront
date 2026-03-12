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
import {NexusService} from "../services/nexus.service";
import {jwtDecode} from "jwt-decode";

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
    IonText,
    IonSpinner
  ]
})
export class LoginPage {
  private nexusService = inject(NexusService);
  private http = inject(HttpClient);
  private router = inject(Router);

  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  handleLogin() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const body = { username: this.username, password: this.password };

    this.http.post('https://nexusapi.up.railway.app/api/login', body).subscribe({
      next: (res: any) => {
        this.isLoading = false; // Arrêter le chargement
        const token = res.token;

        if (token) {
          const decoded: any = jwtDecode(token);
          console.log("Token décodé :", decoded);

          const userId = parseInt(decoded.UserId, 10).toString();
          this.nexusService.saveSession(token, userId);

          this.router.navigate(['/tabs/home']);
        } else {
          this.errorMessage = "Token manquant dans la réponse.";
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error("Erreur API :", err);
        this.errorMessage = "Identifiants incorrects ou serveur injoignable.";
      }
    });
  }
}
