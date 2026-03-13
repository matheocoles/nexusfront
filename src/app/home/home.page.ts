import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonSpinner, ToastController,
  IonModal, IonInput, IonButton, LoadingController
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline, calendarOutline,
  chevronBackOutline, chevronForwardOutline, arrowDownOutline,
  playOutline, bookOutline, fitnessOutline, rocketOutline,
  checkmarkCircleOutline, timeOutline, locationOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonIcon, IonSpinner,
    IonModal, IonInput, IonButton // Ajoutés pour la stabilité du Modal
  ]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private toastController = inject(ToastController);
  private loadingController = inject(LoadingController);
  private router = inject(Router);

  courses: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  isModalOpen = false;
  newSessionTitle = '';
  newSessionRoom = ''; // Nouvelle variable pour le lieu
  selectedType = 'class';
  selectedDuration = 60;

  modalIcons = {
    book: bookOutline,
    fitness: fitnessOutline,
    rocket: rocketOutline
  };

  constructor() {
    addIcons({
      addOutline, searchOutline, menuOutline, calendarOutline,
      chevronBackOutline, chevronForwardOutline, arrowDownOutline,
      playOutline, checkmarkCircleOutline, bookOutline, fitnessOutline, rocketOutline,
      timeOutline, locationOutline
    });
  }

  ngOnInit() {
    this.loadSchedule();
  }

  loadSchedule() {
    this.isLoading = true;
    this.nexusService.getSchedule().subscribe({
      next: (data: any[]) => {
        this.courses = data.sort((a, b) =>
          new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime()
        ).map((item, index) => {
          const name = item.activityName || item.status || `Activité #${item.id}`;

          const formatTime = (dateStr: string) => {
            if (!dateStr) return '--:--';
            const date = new Date(dateStr);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          };

          return {
            ...item,
            name: name,
            room: item.room || (item.sportId ? 'Gymnase' : 'Zone Nexus'),
            startTime: formatTime(item.dateTimeStart),
            endTime: formatTime(item.dateTimeEnd),
            duration: this.calculateDuration(item.dateTimeStart, item.dateTimeEnd),
            displayColor: this.colorPalette[index % this.colorPalette.length]
          };
        });
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast("Erreur de connexion Nexus");
      }
    });
  }

  async confirmAddSession() {
    if (!this.newSessionTitle.trim() || !this.newSessionRoom.trim()) {
      this.showToast("Veuillez saisir un titre et un lieu");
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Initialisation Nexus...',
      spinner: 'crescent',
      cssClass: 'nexus-loader'
    });
    await loading.present();

    const userId = this.nexusService.getUserId();
    const now = new Date();
    const end = new Date(now.getTime() + (this.selectedDuration * 60000));

    const sessionPayload = {
      "DateTimeStart": now.toISOString(),
      "DateTimeEnd": end.toISOString(),
      "Status": this.newSessionTitle,
      "Room": this.newSessionRoom, // Champ Room envoyé au Backend
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": [],
      "ClassId": null,
      "SportId": null,
      "ExtraActivityId": null
    };

    this.nexusService.createSession(sessionPayload).subscribe({
      next: () => {
        loading.dismiss();
        this.isModalOpen = false;
        this.showToast(`Session créée avec succès !`);
        this.loadSchedule();
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur API :", err);
        this.showToast("Erreur lors de la création");
      }
    });
  }

  calculateDuration(start: string, end: string): string {
    if (!start || !end) return '01h00';
    try {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return '01h00';

      const diffMs = e.getTime() - s.getTime();
      const mins = Math.floor(Math.abs(diffMs) / 60000);

      if (mins < 60) return `${mins}min`;
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hrs}h${remainingMins.toString().padStart(2, '0')}` : `${hrs}h00`;
    } catch {
      return '01h00';
    }
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message: `🚀 ${message}`,
      duration: 2500,
      position: 'bottom',
      cssClass: 'nexus-toast'
    });
    await toast.present();
  }

  addNewSession() {
    this.newSessionTitle = '';
    this.newSessionRoom = ''; // Reset du lieu
    this.selectedDuration = 60;
    this.isModalOpen = true;
  }
}
