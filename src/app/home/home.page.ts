import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonSpinner, ToastController,
  IonModal, IonInput, IonButton, LoadingController,
  ActionSheetController, AlertController
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline, calendarOutline,
  chevronBackOutline, chevronForwardOutline, arrowDownOutline,
  playOutline, bookOutline, fitnessOutline, rocketOutline,
  checkmarkCircleOutline, timeOutline, locationOutline,
  trashOutline, createOutline, closeOutline, alertCircleOutline,
  shieldCheckmarkOutline // AJOUTÉ : Indispensable pour la notification HUD
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
  private loadingController = inject(LoadingController);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Variables pour la notification HUD
  isNotifOpen = false;
  notifTitle = '';
  notifMsg = '';

  courses: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  isModalOpen = false;
  isEditMode = false;
  editingSessionId: number | null = null;

  newSessionTitle = '';
  newSessionRoom = '';
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
      timeOutline, locationOutline, trashOutline, createOutline, closeOutline,
      alertCircleOutline, shieldCheckmarkOutline // ENREGISTRÉ ICI
    });
  }

  ngOnInit() {
    this.loadSchedule();
  }

  loadSchedule() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (data: any[]) => {
        this.courses = data.sort((a, b) =>
          new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime()
        ).map((item, index) => ({
          ...item,
          name: item.status || item.Status || `Activité #${item.id}`,
          room: item.room || item.Room || 'Zone Nexus',
          startTime: this.formatTime(item.dateTimeStart),
          endTime: this.formatTime(item.dateTimeEnd),
          duration: this.calculateDuration(item.dateTimeStart, item.dateTimeEnd),
          displayColor: this.colorPalette[index % this.colorPalette.length]
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.showToast("Erreur de connexion Nexus");
      }
    });
  }

  formatTime(dateStr: string) {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  calculateDuration(start: string, end: string): string {
    if (!start || !end) return '1h';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(Math.abs(diffMs) / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    const rMins = mins % 60;
    return rMins > 0 ? `${hrs}h${rMins.toString().padStart(2, '0')}` : `${hrs}h`;
  }

  async presentActionSheet(course: any) {
    const actionSheet = await this.actionSheetController.create({
      header: course.name.toUpperCase(),
      subHeader: `Lieu : ${course.room}`,
      cssClass: 'nexus-action-sheet',
      buttons: [
        { text: 'Modifier', icon: createOutline, handler: () => this.openEditModal(course) },
        { text: 'Supprimer', role: 'destructive', icon: trashOutline, handler: () => this.confirmDelete(course) },
        { text: 'Annuler', icon: closeOutline, role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async confirmDelete(course: any) {
    const alert = await this.alertController.create({
      header: 'SUPPRESSION',
      message: `Voulez-vous supprimer "${course.name}" ?`,
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'ANNULER', role: 'cancel', cssClass: 'alert-button-cancel' },
        { text: 'SUPPRIMER', role: 'destructive', cssClass: 'alert-button-confirm', handler: () => this.deleteSession(course.id) }
      ]
    });
    await alert.present();
  }

  async deleteSession(id: any) {
    // 1. Suppression visuelle instantanée
    const idToDelete = String(id);
    this.courses = [...this.courses.filter(course => String(course.id) !== idToDelete)];
    this.cdr.detectChanges();

    // 2. Petit loader discret
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      cssClass: 'nexus-loader-small',
      duration: 1000
    });
    await loading.present();

    this.nexusService.deleteSession(id).subscribe({
      next: async () => {
        await loading.dismiss();
        this.showNexusNotification('SUPPRIMÉ', 'La session a été retirée');
      },
      error: async () => {
        await loading.dismiss();
        this.showNexusNotification('SÉCURITÉ', 'Suppression locale confirmée');
      }
    });
  }

  async showNexusNotification(title: string, msg: string) {
    this.notifTitle = title;
    this.notifMsg = msg;
    this.isNotifOpen = true;
    this.cdr.detectChanges(); // Force l'affichage du modal

    // Auto-fermeture après 2.5 secondes
    setTimeout(() => {
      this.isNotifOpen = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim() || !this.newSessionRoom.trim()) {
      this.showToast("Veuillez remplir tous les champs");
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Synchronisation...',
      spinner: 'crescent',
      cssClass: 'nexus-loader'
    });
    await loading.present();

    const userId = this.nexusService.getUserId();
    const now = new Date();
    const end = new Date(now.getTime() + (this.selectedDuration * 60000));

    const payload = {
      "Id": this.editingSessionId,
      "DateTimeStart": now.toISOString(),
      "DateTimeEnd": end.toISOString(),
      "Status": this.newSessionTitle,
      "Room": this.newSessionRoom,
      "LoginId": userId ? parseInt(userId, 10) : 0
    };

    // On prépare le type de requête
    const isEdit = !!(this.isEditMode && this.editingSessionId);
    const request = isEdit
      ? this.nexusService.updateSession(this.editingSessionId!, payload)
      : this.nexusService.createSession(payload);

    request.subscribe({
      next: async () => {
        await loading.dismiss();
        this.isModalOpen = false;

        // CHOIX DU MESSAGE SELON LE MODE
        if (isEdit) {
          this.showNexusNotification('MODIFIÉ', 'Changements enregistrés');
        } else {
          this.showNexusNotification('AJOUTÉ', 'Nouvelle session enregistrée');
        }

        this.loadSchedule();
      },
      error: async () => {
        await loading.dismiss();
        this.showToast("Erreur de connexion API");
      }
    });
  }

  openEditModal(course: any) {
    this.isEditMode = true;
    this.editingSessionId = course.id;
    this.newSessionTitle = course.name;
    this.newSessionRoom = course.room;
    this.isModalOpen = true;
  }

  addNewSession() {
    this.isEditMode = false;
    this.editingSessionId = null;
    this.newSessionTitle = '';
    this.newSessionRoom = '';
    this.isModalOpen = true;
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message: `🚀 ${message}`,
      duration: 2000,
      position: 'bottom',
      cssClass: 'nexus-toast-simple'
    });
    await toast.present();
  }
}
