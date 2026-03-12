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
  // Dégradé Bordeaux -> Mauve (selon tes images)
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
          // Extraction dynamique du nom selon la table liée
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

  // Action pour le bouton "+" (Ajout manuel)
  async addNewSession() {
    const alert = await this.alertController.create({
      header: 'Nouvelle activité',
      cssClass: 'nexus-alert',
      inputs: [{ name: 'title', type: 'text', placeholder: 'Nom de l\'activité (ex: Révision)' }],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Démarrer',
          handler: (data) => this.startSession({ status: data.title || 'Session Libre' })
        }
      ]
    });
    await alert.present();
  }

  // Clic sur un cours de la liste
  async startSession(item: any) {
    const sessionPayload = {
      dateTimeStart: new Date().toISOString(),
      status: item.status || 'In Progress',
      classId: item.classId || null,
      sportId: item.sportId || null,
      extraActivityId: item.extraActivityId || null,
      achievementIds: []
    };

    this.nexusService.createSession(sessionPayload).subscribe({
      next: (res) => {
        this.showToast(res.activityName || 'Session démarrée');
        // Redirection vers la page Timer après un court délai
        setTimeout(() => {
          this.router.navigate(['/timer'], { state: { session: res } });
        }, 1200);
      },
      error: (err) => console.error("Erreur POST /sessions (405?):", err)
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
