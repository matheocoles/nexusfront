import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonSpinner, ToastController, AlertController,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonInput
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
    IonModal
  ]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private toastController = inject(ToastController);
  private router = inject(Router);

  // Données
  courses: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  // Variables pour le Modal
  isModalOpen = false;
  newSessionTitle = '';
  selectedType = 'class';

  // Sécurité pour les icônes du modal (évite l'erreur URL constructor)
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
      next: (data) => {
        this.courses = data.map((item, index) => ({
          ...item,
          name: item.class?.name || item.sport?.name || item.extraActivity?.name || 'Activité libre',
          room: item.class?.room || (item.sport ? 'Gymnase' : 'Nexus Zone'),
          displayColor: this.colorPalette[index % this.colorPalette.length]
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Erreur API Activity:", err);
        this.isLoading = false;
      }
    });
  }

  // Ouvre le modal bordeaux
  addNewSession() {
    this.newSessionTitle = '';
    this.isModalOpen = true;
  }

  // Valide le modal
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
      error: (err) => {
        console.error("Erreur session manuelle :", err);
        this.showToast("Erreur lors de la création");
      }
    });
  }

  async startSession(item: any) {
    const userId = this.nexusService.getUserId();
    const today = new Date().toISOString().split('T')[0];

    const sessionPayload: any = {
      "DateTimeStart": today,
      "DateTimeEnd": null,
      "Status": item.status || 'En cours',
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": []
    };

    const activityId = item.id || item.Id || item.classId || item.sportId || item.extraActivityId;
    if (item.class || item.classId) sessionPayload["ClassId"] = activityId;
    else if (item.sport || item.sportId) sessionPayload["SportId"] = activityId;
    else if (item.extraActivity || item.extraActivityId) sessionPayload["ExtraActivityId"] = activityId;

    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(res.activityName || 'Session démarrée');
        this.router.navigate(['/tabs/timer'], { state: { session: res } });
      },
      error: (err) => {
        console.error("Erreur serveur :", err);
        this.showToast("Erreur de format (DateOnly)");
      }
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
