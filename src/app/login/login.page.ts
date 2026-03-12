import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonSpinner
} from '@ionic/angular/standalone';
import { NexusService } from "../services/nexus.service";
import { jwtDecode } from "jwt-decode";
import {HttpClient} from "@angular/common/http";

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
  private router = inject(Router);
  private readonly http = inject(HttpClient);

  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  handleLogin() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Identifiants requis.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginCredentials = { username: this.username, password: this.password };

    this.nexusService.login(loginCredentials).subscribe({
      next: (res: any) => {
        if (res.token) {
          const decoded: any = jwtDecode(res.token);
          console.log("Contenu du Token :", decoded); // <--- REGARDE TA CONSOLE NAVIGATEUR (F12)

          // Si 'UserId' est vide, essaie les autres variantes courantes
          const userId = decoded.UserId || decoded.userid || decoded.id || decoded.sub;

          if (userId) {
            this.nexusService.saveSession(res.token, userId);
            this.router.navigate(['/tabs/home']);
          } else {
            console.error("Impossible de trouver l'ID utilisateur dans le token");
          }
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error("Erreur détaillée :", err);
        // Si c'est encore une 404, on affiche un message clair
        this.errorMessage = err.status === 404
          ? "Le serveur ne trouve pas la route /api/login"
          : "Identifiants incorrects.";
      }
    });
  }
}
