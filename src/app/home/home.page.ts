import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon, IonSpinner, ToastController, AlertController } from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline,
  chevronBackOutline, chevronForwardOutline, arrowDownOutline,
  playOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonSpinner]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private router = inject(Router);

  courses: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

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

  async addNewSession() {
    const alert = await this.alertController.create({
      header: 'Nouvelle activité manuelle',
      cssClass: 'nexus-alert',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Nom de l\'activité (ex: Musculation)'
        },
        {
          type: 'radio',
          label: 'Cours / Études',
          value: 'class',
          checked: true
        },
        {
          type: 'radio',
          label: 'Sport',
          value: 'sport'
        },
        {
          type: 'radio',
          label: 'Autre activité',
          value: 'extra'
        }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Démarrer',
          handler: (data) => {
            if (!data.title) return false;
            this.startManualSession(data.title, data.value);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async startManualSession(title: string, type: string) {
    const userId = this.nexusService.getUserId();
    const today = new Date().toISOString().split('T')[0];

    const sessionPayload: any = {
      "DateTimeStart": today,
      "DateTimeEnd": null,
      "Status": title, // On met le nom choisi dans le status pour le retrouver
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": []
    };


    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(`Session "${title}" démarrée`);
        this.router.navigate(['/tabs/timer'], { state: { session: res } });
      },
      error: (err) => {
        console.error("Erreur session manuelle :", err.error.errors);
        this.showToast("Erreur lors de la création");
      }
    });
  }

  async startSession(item: any) {
    const userId = this.nexusService.getUserId();

    const today = new Date().toISOString().split('T')[0];

    const sessionPayload: any = {
      "DateTimeStart": today, // Plus d'heure, juste la date
      "DateTimeEnd": null,
      "Status": item.status || 'En cours',
      "LoginId": userId ? parseInt(userId, 10) : 0,
      "AchievementIds": []
    };

    const activityId = item.Id || item.id || item.classId || item.sportId || item.extraActivityId;

    if (item.class || item.classId) {
      sessionPayload["ClassId"] = activityId;
    } else if (item.sport || item.sportId) {
      sessionPayload["SportId"] = activityId;
    } else if (item.extraActivity || item.extraActivityId) {
      sessionPayload["ExtraActivityId"] = activityId;
    }

    console.log("Payload corrigé (DateOnly) :", sessionPayload);

    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(res.activityName || 'Session démarrée');
        this.router.navigate(['/tabs/timer'], { state: { session: res } });
      },
      error: (err) => {
        console.error("Erreur détaillée du serveur :", err.error.errors);
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
