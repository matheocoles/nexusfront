import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonIcon,
  IonSpinner, AlertController, IonInput, IonProgressBar, LoadingController
} from '@ionic/angular/standalone';

import { NexusService } from "../services/nexus.service";
import { addIcons } from 'ionicons';
import {
  personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline
} from 'ionicons/icons';
import { jwtDecode } from "jwt-decode";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  providers: [DecimalPipe],
  imports: [
    CommonModule, FormsModule, IonContent, IonIcon, IonSpinner, IonCard,
    IonCardContent, IonButton, IonInput, IonProgressBar
  ]
})
export class ProfilePage implements OnInit, OnDestroy {
  private nexusService = inject(NexusService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);
  private http = inject(HttpClient);

  userData: any = null;
  isEditing: boolean = false;
  newPassword: string = "";

  days: number = 0;
  minutes: number = 0;
  seconds: number = 0;
  progress: number = 0;
  timerInterval: any;

  constructor() {
    addIcons({
      personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline
    });
  }

  ngOnInit() {
    this.loadProfileData();
    this.initPersistentTimer();
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  initPersistentTimer() {
    let startTime = localStorage.getItem('nexus_start_time');
    if (!startTime) {
      startTime = new Date().getTime().toString();
      localStorage.setItem('nexus_start_time', startTime);
    }
    this.updateTimerDisplay(parseInt(startTime));
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay(parseInt(startTime!));
    }, 1000);
  }

  updateTimerDisplay(startTime: number) {
    const now = new Date().getTime();
    const diffInSeconds = Math.floor((now - startTime) / 1000);
    this.days = Math.floor(diffInSeconds / 86400);
    this.minutes = Math.floor((diffInSeconds % 3600) / 60);
    this.seconds = diffInSeconds % 60;
    this.progress = (diffInSeconds % 86400) / 86400;
  }

  getTrophyTitle(): string {
    if (this.days >= 30) return "Légende Nexus";
    if (this.days >= 7) return "Habitué";
    return "Nouveau Membre";
  }

  loadProfileData() {
    const token = localStorage.getItem('nexus_token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);

      // Extraction sécurisée
      const userId = String(decoded.UserId || decoded.id || '004');
      const userName = decoded.Username || decoded.username || 'Utilisateur';
      const fullName = decoded.FullName || decoded.fullname || 'Membre Nexus';

      this.userData = {
        id: userId,
        username: userName,
        fullName: fullName
      };

      console.log("Profil chargé depuis le Token pour l'ID:", userId);

    } catch (e) {
      console.error("Erreur décodage Token", e);
      this.router.navigate(['/login']);
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.newPassword = "";
  }

  async saveChanges() {
    if (!this.userData) return;

    const loading = await this.loadingController.create({ message: 'Enregistrement...' });
    await loading.present();

    const updateData = {
      Id: parseInt(this.userData.id, 10),
      Username: this.userData.username,
      FullName: this.userData.fullName,
      Password: this.newPassword || null
    };

    this.http.put(`https://nexusapi.up.railway.app/api/logins`, updateData, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
    }).subscribe({
      next: () => {
        loading.dismiss();
        this.isEditing = false;
        this.newPassword = "";
        this.loadProfileData();
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur update", err);
      }
    });
  }

  async handleLogout() {
    const alert = await this.alertController.create({
      header: 'Déconnexion',
      message: 'Voulez-vous vous déconnecter ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Oui',
          role: 'destructive',
          handler: () => {
            localStorage.clear();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}
