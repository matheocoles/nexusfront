import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonSpinner, ToastController,
  IonModal, IonInput, IonButton
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline,
  chevronBackOutline, chevronForwardOutline, arrowDownOutline,
  playOutline, bookOutline, fitnessOutline, rocketOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonIcon, IonSpinner,
    IonModal,
  ]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private toastController = inject(ToastController);
  private router = inject(Router);

  courses: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  isModalOpen = false;
  newSessionTitle = '';
  selectedType = 'class';

  modalIcons = {
    book: bookOutline,
    fitness: fitnessOutline,
    rocket: rocketOutline
  };

  constructor() {
    addIcons({
      addOutline, searchOutline, menuOutline,
      chevronBackOutline, chevronForwardOutline, arrowDownOutline, playOutline
    });
  }

  ngOnInit() {
    this.loadSchedule();
  }

  loadSchedule() {
    this.isLoading = true;
    this.nexusService.getSchedule().subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          console.log("CLÉS DÉTECTÉES :", Object.keys(data[0]));
          console.log("PREMIER OBJET COMPLET :", data[0]);
        }

        this.courses = data.map((item, index) => {
          const name = item.activityName || item.status || `Session #${item.id}`;

          const rawStart = item.dateTimeStart;
          const rawEnd = item.dateTimeEnd;

          let start = '--:--';
          if (rawStart) {
            start = rawStart.includes('T') ? rawStart.split('T')[1].substring(0, 5) : '08:00';
          }

          return {
            ...item,
            name: name,
            room: item.room || 'Nexus Zone',
            startTime: start,
            endTime: '--:--',
            duration: '01:00',
            displayColor: this.colorPalette[index % this.colorPalette.length]
          };
        });

        console.log("COURS AFFICHÉS (MAPPED) :", this.courses);
        this.isLoading = false;
      },
      error: (err) => {
        console.error("ERREUR API :", err);
        this.isLoading = false;
      }
    });
  }

  calculateDuration(start: string, end: string): string {
    try {
      if (!start || !end) return '01:00';
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return '01:00';

      const diffMs = e.getTime() - s.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      return `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
    } catch {
      return '01:00';
    }
  }

  // --- LOGIQUE MODAL & SESSIONS ---
  addNewSession() {
    this.newSessionTitle = '';
    this.isModalOpen = true;
  }

  confirmAddSession() {
    if (!this.newSessionTitle.trim()) {
      this.showToast("Donnez un nom à l'activité");
      return;
    }
    this.isModalOpen = false;
    this.startManualSession(this.newSessionTitle, this.selectedType);
  }

  async startManualSession(title: string, type: string) {
    const userId = this.nexusService.getUserId();
    const today = new Date().toISOString().split('T')[0];

    const sessionPayload: any = {
      "DateTimeStart": today,
      "DateTimeEnd": null,
      "Status": title,
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": []
    };

    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(`Session "${title}" démarrée`);
        this.router.navigate(['/tabs/timer'], { state: { session: res } });
      },
      error: () => this.showToast("Erreur lors de la création")
    });
  }

  async startSession(item: any) {
    const userId = this.nexusService.getUserId();
    const today = new Date().toISOString().split('T')[0];

    // On utilise les nouveaux champs du DTO pour identifier le type d'activité
    const sessionPayload: any = {
      "DateTimeStart": today,
      "DateTimeEnd": null,
      "Status": "En cours",
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": []
    };

    // Mapping selon le type renvoyé par le Backend
    if (item.typeLabel === "Cours") sessionPayload["ClassId"] = item.id;
    else if (item.typeLabel === "Sport") sessionPayload["SportId"] = item.id;
    else if (item.typeLabel === "Extra") sessionPayload["ExtraActivityId"] = item.id;

    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(res.activityName || 'Session démarrée');
        this.router.navigate(['/tabs/timer'], { state: { session: res } });
      },
      error: () => this.showToast("Erreur serveur")
    });
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message: `🚀 ${message}`,
      duration: 2000,
      position: 'bottom',
      cssClass: 'nexus-toast'
    });
    await toast.present();
  }
}
