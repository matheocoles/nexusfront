import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonContent, IonIcon, IonItem, IonLabel, IonList,
  IonSpinner, AlertController, IonInput, IonProgressBar // Ajout de IonProgressBar
} from '@ionic/angular/standalone';

import { NexusService } from "../services/nexus.service";
import { addIcons } from 'ionicons';
import {
  personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline
} from 'ionicons/icons';
import {jwtDecode} from "jwt-decode";

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
  private http = inject(HttpClient);

  userData: any;
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

    // Progression sur un cycle de 24h (86400 secondes)
    const secondsToday = diffInSeconds % 86400;
    this.progress = secondsToday / 86400;
  }

  getTrophyTitle(): string {
    if (this.days >= 30) return "Légende Nexus";
    if (this.days >= 7) return "Habitué";
    return "Nouveau Membre";
  }

  loadProfileData() {
    const id = this.nexusService.getUserId();

    const token = localStorage.getItem('nexus_token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.userData = {
          username: decoded.Username,
          fullName: decoded.FullName,
          id: decoded.UserId
        };
      } catch(e) {}
    }

    if (id) {
      this.nexusService.getUserProfile(id).subscribe({
        next: (data) => {
          this.userData = data;
          console.log("Profil chargé depuis l'API !");
        },
        error: (err) => {
          console.error("L'API rejette encore l'ID. On garde les infos du token.", err);
        }
      });
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.newPassword = "";
  }

  async saveChanges() {
    const id = this.nexusService.getUserId();
    if (id && this.userData) {
      const updateData = {
        id: parseInt(id),
        username: this.userData.username,
        fullName: this.userData.fullName,
        password: this.newPassword || ""
      };

      this.http.put(`https://nexusapi.up.railway.app/api/logins`, updateData, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
      }).subscribe({
        next: (res: any) => {
          this.isEditing = false;
          this.newPassword = "";
          this.loadProfileData();
          console.log("Changements enregistrés !");
        },
        error: (err: any) => console.error("Erreur update", err)
      });
    }
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
