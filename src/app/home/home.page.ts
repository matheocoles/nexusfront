import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonSpinner, ToastController,
  IonModal, LoadingController,
  ActionSheetController, AlertController
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline, calendarOutline,
  chevronBackOutline, chevronForwardOutline, arrowDownOutline,
  playOutline, bookOutline, fitnessOutline, rocketOutline,
  checkmarkCircleOutline, // Contour pour le bouton confirm
  checkmarkCircle,        // Plein pour la validation HUD (Correction Erreur URL)
  timeOutline, locationOutline,
  trashOutline, createOutline, closeOutline, alertCircleOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner, IonModal]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private toastController = inject(ToastController);
  private loadingController = inject(LoadingController);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  // Notifications HUD
  isNotifOpen = false;
  notifTitle = '';
  notifMsg = '';

  // Data
  courses: any[] = [];
  categoryList: any[] = [];
  isLoading: boolean = true;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  // Modal & Formulaire
  isModalOpen = false;
  isEditMode = false;
  editingSessionId: number | null = null;

  newSessionTitle = '';
  newSessionRoom = '';
  selectedType = 'class';
  selectedCategoryId: number | null = null;
  selectedDuration = 60;

  modalIcons = { book: bookOutline, fitness: fitnessOutline, rocket: rocketOutline };

  constructor() {
    // CORRECTION : Enregistrement strict des noms utilisés dans le HTML
    addIcons({
      'add-outline': addOutline,
      'search-outline': searchOutline,
      'menu-outline': menuOutline,
      'calendar-outline': calendarOutline,
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'arrow-down-outline': arrowDownOutline,
      'play-outline': playOutline,
      'book-outline': bookOutline,
      'fitness-outline': fitnessOutline,
      'rocket-outline': rocketOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'checkmark-circle': checkmarkCircle, // L'icône qui causait l'erreur URL constructor
      'time-outline': timeOutline,
      'location-outline': locationOutline,
      'trash-outline': trashOutline,
      'create-outline': createOutline,
      'close-outline': closeOutline,
      'alert-circle-outline': alertCircleOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline
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
          new Date(a.dateTimeStart || a.DateTimeStart).getTime() - new Date(b.dateTimeStart || b.DateTimeStart).getTime()
        ).map((item, index) => ({
          ...item,
          name: item.status || item.Status || `Session #${item.id}`,
          room: item.class?.name || item.sport?.name || item.extraActivity?.name || 'Zone Nexus',
          startTime: this.formatTime(item.dateTimeStart || item.DateTimeStart),
          endTime: this.formatTime(item.dateTimeEnd || item.DateTimeEnd),
          duration: this.calculateDuration(item.dateTimeStart || item.DateTimeStart, item.dateTimeEnd || item.DateTimeEnd),
          displayColor: this.colorPalette[index % this.colorPalette.length],
          isDone: item.status?.includes('TERMINÉE') // Persistance basique de l'état
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.showToast("Erreur de liaison Nexus");
      }
    });
  }

  async loadCategories() {
    this.categoryList = [];
    let obs = this.selectedType === 'class' ? this.nexusService.getClasses() :
      this.selectedType === 'sport' ? this.nexusService.getSports() :
        this.nexusService.getExtra();

    obs.subscribe({
      next: (data) => {
        this.categoryList = data;
        this.cdr.detectChanges();
      },
      error: () => this.showToast("Erreur de chargement")
    });
  }

  changeType(type: string) {
    this.selectedType = type;
    this.selectedCategoryId = null;
    this.loadCategories();
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim()) {
      this.showToast("Titre requis");
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Sync Nexus...',
      spinner: 'crescent',
      cssClass: 'nexus-loader'
    });
    await loading.present();

    const userId = this.nexusService.getUserId();
    const now = new Date();
    const end = new Date(now.getTime() + (this.selectedDuration * 60000));

    const payload: any = {
      dateTimeStart: now.toISOString(),
      dateTimeEnd: end.toISOString(),
      status: this.newSessionTitle,
      loginId: userId ? parseInt(userId, 10) : 0,
      classId: this.selectedType === 'class' ? this.selectedCategoryId : null,
      sportId: this.selectedType === 'sport' ? this.selectedCategoryId : null,
      extraActivityId: this.selectedType === 'extra' ? this.selectedCategoryId : null
    };

    if (this.isEditMode && this.editingSessionId) payload.id = this.editingSessionId;

    const request = this.isEditMode
      ? this.nexusService.updateSession(this.editingSessionId!, payload)
      : this.nexusService.createSession(payload);

    request.subscribe({
      next: async () => {
        await loading.dismiss();
        this.isModalOpen = false;
        this.showNexusNotification(this.isEditMode ? 'MODIFIÉ' : 'AJOUTÉ', 'Base de données mise à jour');
        this.loadSchedule();
      },
      error: async () => {
        await loading.dismiss();
        this.showToast("Erreur API Railway");
      }
    });
  }

  async deleteSession(id: any) {
    const numericId = parseInt(id, 10);
    this.nexusService.deleteSession(numericId).subscribe({
      next: () => {
        this.courses = this.courses.filter(c => c.id !== numericId);
        this.showNexusNotification('SUPPRIMÉ', 'Session effacée');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Erreur 400 Détails:", err.error);
        this.showToast("Erreur de suppression");
      }
    });
  }

  validateSession(course: any, event: any) {
    event.stopPropagation();
    course.isDone = true;

    // Notification HUD
    this.notifTitle = "SÉQUENCE TERMINÉE";
    this.notifMsg = "+100 XP SYSTÈME";
    this.isNotifOpen = true;

    // Optionnel : Mise à jour réelle en BDD
    this.nexusService.updateSession(course.id, {
      ...course,
      status: course.name + " [TERMINÉE]"
    }).subscribe();

    this.cdr.detectChanges();
    setTimeout(() => {
      this.isNotifOpen = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  // Helpers
  formatTime(dateStr: string) {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  calculateDuration(start: string, end: string): string {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(diff / 60000);
    return mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 || ''}` : `${mins}min`;
  }

  async openEditModal(course: any) {
    this.isEditMode = true;
    this.editingSessionId = course.id;
    this.newSessionTitle = course.name;
    this.selectedType = course.classId ? 'class' : (course.sportId ? 'sport' : 'extra');
    this.selectedCategoryId = course.classId || course.sportId || course.extraActivityId;
    this.loadCategories();
    this.isModalOpen = true;
  }

  addNewSession() {
    this.isEditMode = false;
    this.editingSessionId = null;
    this.newSessionTitle = '';
    this.selectedCategoryId = null;
    this.loadCategories();
    this.isModalOpen = true;
  }

  async presentActionSheet(course: any) {
    const actionSheet = await this.actionSheetController.create({
      header: course.name.toUpperCase(),
      cssClass: 'nexus-action-sheet',
      buttons: [
        { text: 'Modifier', icon: 'create-outline', handler: () => this.openEditModal(course) },
        { text: 'Supprimer', role: 'destructive', icon: 'trash-outline', handler: () => this.confirmDelete(course) },
        { text: 'Annuler', icon: 'close-outline', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async confirmDelete(course: any) {
    const alert = await this.alertController.create({
      header: 'SUPPRESSION',
      message: `Supprimer "${course.name}" ?`,
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'ANNULER', role: 'cancel' },
        { text: 'SUPPRIMER', handler: () => this.deleteSession(course.id) }
      ]
    });
    await alert.present();
  }

  async showNexusNotification(title: string, msg: string) {
    this.notifTitle = title;
    this.notifMsg = msg;
    this.isNotifOpen = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.isNotifOpen = false;
      this.cdr.detectChanges();
    }, 2500);
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
