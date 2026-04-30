import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, LoadingController, ActionSheetController } from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {forkJoin, Observable, of} from 'rxjs';
import {
  addOutline, searchOutline, menuOutline, playOutline, bookOutline, fitnessOutline,
  rocketOutline, checkmarkCircle, locationOutline, trashOutline, closeOutline,
  shieldCheckmarkOutline, chevronBackOutline, chevronForwardOutline, ellipseOutline, layersOutline, createOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonModal]
})
export class HomePage implements OnInit {
  private nexusService = inject(NexusService);
  private loadingCtrl = inject(LoadingController);
  private actionSheetCtrl = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);

  currentEditingSession: any = null;
  courses: any[] = [];
  filteredCourses: any[] = [];
  isLoading = true;
  isModalOpen = false;

  isEditing = false;
  editingSessionId: number | null = null;
  repeatWeeks = 0; // 0 = une fois, 1 = 2 semaines, etc.

  currentDate: Date = new Date();
  displayDateLabel = "Aujourd'hui";
  selectedStartDate: string = new Date().toISOString().split('T')[0];
  selectedStartTime: string = "08:00";

  newSessionTitle = '';
  selectedType = 'class';
  selectedDuration = 60;
  sessionData = {
    // Champs communs (Activity)
    description: 'Mission Nexus',
    // Champs Class
    subject: '',
    teacher: '',
    room: '',
    objective: '',
    // Champs Sport
    type: '',
    place: '',
    intensity: 'Medium',
    // Champs ExtraActivity
    organiser: '',
    theme: '',
    resource: ''
  };
  private palette = ['#911F45', '#4A1E60', '#2a0a14', '#5e102e'];

  constructor() {
    addIcons({
      'add-outline': addOutline, 'search-outline': searchOutline, 'menu-outline': menuOutline,
      'play-outline': playOutline, 'book-outline': bookOutline, 'fitness-outline': fitnessOutline,
      'rocket-outline': rocketOutline, 'checkmark-circle': checkmarkCircle, 'location-outline': locationOutline,
      'trash-outline': trashOutline, 'close-outline': closeOutline, 'shield-checkmark-outline': shieldCheckmarkOutline,
      'chevron-back-outline': chevronBackOutline, 'chevron-forward-outline': chevronForwardOutline,
      'ellipse-outline': ellipseOutline, 'layers-outline': layersOutline, 'create-outline': createOutline
    });
  }

  ngOnInit() { this.loadSchedule(true); }

  nextDay() {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.updateDateLabel();
    this.loadSchedule(false);
  }

  prevDay() {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.updateDateLabel();
    this.loadSchedule(false);
  }

  private updateDateLabel() {
    const today = new Date();
    if (this.currentDate.toDateString() === today.toDateString()) this.displayDateLabel = "Aujourd'hui";
    else this.displayDateLabel = this.currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  loadSchedule(showLoader: boolean = false) {
    if (showLoader) this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (res) => {
        const dayStr = this.currentDate.toDateString();
        this.courses = res
          .filter(s => new Date(s.dateTimeStart).toDateString() === dayStr)
          .map((s, i) => ({
            ...s,
            name: s.status || 'Mission',
            room: s.class?.room || s.sport?.place || s.extraActivity?.place || 'Zone Nexus',
            startTime: this.formatTime(s.dateTimeStart),
            endTime: this.formatTime(s.dateTimeEnd),
            displayColor: this.palette[i % this.palette.length],
            isDone: s.status?.includes('[TERMINÉE]'),
            duration: this.calcDur(s.dateTimeStart, s.dateTimeEnd)
          }))
          .sort((a, b) => new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime());

        this.filteredCourses = [...this.courses];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  addNewSession() {
    this.isEditing = false;
    this.editingSessionId = null;
    this.newSessionTitle = '';
    this.repeatWeeks = 0;
    this.isModalOpen = true;
  }

  async editSession(course: any) {
    this.isEditing = true;
    this.currentEditingSession = course; // On garde une copie complète
    this.editingSessionId = course.id;
    this.newSessionTitle = course.name.replace(" [TERMINÉE]", ""); // On nettoie le titre

    const start = new Date(course.dateTimeStart);
    this.selectedStartDate = start.toISOString().split('T')[0];
    this.selectedStartTime = start.toTimeString().split(' ')[0].substring(0, 5);

    const diff = Math.round((new Date(course.dateTimeEnd).getTime() - start.getTime()) / 60000);
    this.selectedDuration = diff;

    // On détermine le type pour l'affichage (visuel seulement car verrouillé en édition)
    if (course.classId) this.selectedType = 'class';
    else if (course.sportId) this.selectedType = 'sport';
    else if (course.extraActivityId) this.selectedType = 'extra';

    this.isModalOpen = true;
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim()) return;
    const loading = await this.loadingCtrl.create({ message: 'SYNCHRONISATION...' });
    await loading.present();

    // On prépare l'activité (Class, Sport ou Extra) selon le diagramme image_efb419.png
    let obs: Observable<any>;
    const baseActivity = { Name: this.newSessionTitle, Description: this.sessionData.description };

    if (this.selectedType === 'class') {
      obs = this.nexusService.createClass({
        ...baseActivity,
        Subject: this.sessionData.subject,
        Teacher: this.sessionData.teacher,
        Room: this.sessionData.room,
        Objective: this.sessionData.objective
      });
    } else if (this.selectedType === 'sport') {
      obs = this.nexusService.createSport({
        ...baseActivity,
        Type: this.sessionData.type,
        Place: this.sessionData.place,
        Intensity: this.sessionData.intensity,
        Duration: this.selectedDuration.toString()
      });
    } else {
      obs = this.nexusService.createExtra({
        ...baseActivity,
        Organiser: this.sessionData.organiser,
        Place: this.sessionData.place,
        Theme: this.sessionData.theme,
        Resource: this.sessionData.resource
      });
    }

    obs.subscribe({
      next: (entity) => {
        const start = new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`);
        const end = new Date(start.getTime() + (this.selectedDuration * 60000));

        // Construction du payload Session (doit correspondre à ta capture d'écran de la DB)
        const sessionPayload = {
          Id: this.editingSessionId, // CRITIQUE : Doit être présent
          DateTimeStart: new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`).toISOString(),
          DateTimeEnd: new Date(new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`).getTime() + (this.selectedDuration * 60000)).toISOString(),
          Status: this.newSessionTitle, // Avec Majuscule
          LoginId: 7, // Ton ID utilisateur dans la DB

          // Renvoyer les IDs de ton schéma
          ClassId: this.selectedType === 'class' ? this.currentEditingSession.classId : null,
          SportId: this.selectedType === 'sport' ? this.currentEditingSession.sportId : null,
          ExtraActivityId: this.selectedType === 'extra' ? this.currentEditingSession.extraActivityId : null
        };

        const request = this.isEditing
          ? this.nexusService.updateSession(this.editingSessionId, sessionPayload)
          : this.nexusService.createSession(sessionPayload);

        request.subscribe({
          next: () => {
            loading.dismiss();
            this.isModalOpen = false;
            this.loadSchedule(false);
            this.nexusService.showToast('BDD MISE À JOUR');
          },
          error: () => {
            loading.dismiss();
            this.nexusService.showToast('ERREUR SESSION');
          }
        });
      },
      error: (err) => {
        console.error("Erreur 500 sur l'activité. Vérifiez les champs du diagramme.", err);
        loading.dismiss();
        this.nexusService.showToast('ERREUR CRÉATION ACTIVITÉ');
      }
    });
  }

  validateSession(course: any, event: any) {
    event.stopPropagation();

    let newStatus: string;
    const tag = " [TERMINÉE]";

    if (course.isDone) {
      newStatus = course.name.replace(tag, "");
      course.isDone = false;
    } else {
      newStatus = course.name + tag;
      course.isDone = true;
    }

    this.nexusService.updateSession(course.id, { ...course, status: newStatus }).subscribe({
      next: () => {
        this.loadSchedule(false);
      },
      error: () => {
        course.isDone = !course.isDone;
        this.cdr.detectChanges();
      }
    });
  }

  async presentActionSheet(course: any) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'MISSION: ' + course.name.toUpperCase(),
      buttons: [
        {
          text: 'Modifier',
          icon: 'create-outline',
          handler: () => { this.editSession(course); }
        },
        {
          text: 'Supprimer',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.nexusService.deleteSession(course.id).subscribe(() => this.loadSchedule(false));
          }
        },
        { text: 'Annuler', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  onSearch(event: any) {
    const val = event.target.value.toLowerCase();
    this.filteredCourses = this.courses.filter(c => c.name.toLowerCase().includes(val));
  }

  private formatTime(d: string) { return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
  private calcDur(s: string, e: string) {
    const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000);
    return diff >= 60 ? `${Math.floor(diff/60)}h${diff%60 || ''}` : `${diff}m`;
  }
}
