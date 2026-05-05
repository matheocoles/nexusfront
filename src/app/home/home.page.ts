import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, LoadingController, ActionSheetController } from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import { Observable } from 'rxjs';
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

  courses: any[] = [];
  filteredCourses: any[] = [];
  isLoading = true;
  isModalOpen = false;
  isEditing = false;
  editingSessionId: any = null;
  repeatWeeks = 0;

  currentDate: Date = new Date();
  displayDateLabel = "Aujourd'hui";
  selectedStartDate: string = new Date().toISOString().split('T')[0];
  selectedStartTime: string = "08:00";
  selectedDuration = 60;
  selectedType = 'class';
  newSessionTitle = '';

  sessionData: any = {
    description: 'Mission Nexus',
    selectedActivityIds: [] as number[],
    subject: '', teacher: '', room: '', objective: '',
    type: '', place: '', intensity: 'Medium',
    organiser: '', theme: '', resource: ''
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

  ngOnInit() {
    this.loadSchedule(true);
  }

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
    if (this.currentDate.toDateString() === today.toDateString()) {
      this.displayDateLabel = "Aujourd'hui";
    } else {
      this.displayDateLabel = this.currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }
  }

  loadSchedule(showLoader: boolean = false) {
    if (showLoader) this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (res) => {
        const dayStr = this.currentDate.toDateString();
        this.courses = res
          .filter(s => new Date(s.dateTimeStart || s.DateTimeStart).toDateString() === dayStr)
          .map((s, i) => {
            // Extraction de la première activité pour l'affichage (Room/Type)
            const activities = s.Activities || s.activities || [];
            const mainAct = activities.length > 0 ? activities[0] : null;

            return {
              ...s,
              id: s.Id || s.id,
              name: s.Status || s.status || 'Mission',
              room: mainAct ? (mainAct.Room || mainAct.room || mainAct.Place || mainAct.place || 'Zone Nexus') : 'Zone Nexus',
              startTime: this.formatTime(s.DateTimeStart || s.dateTimeStart),
              endTime: this.formatTime(s.DateTimeEnd || s.dateTimeEnd),
              displayColor: this.palette[i % this.palette.length],
              isDone: (s.Status || s.status || '').includes('[TERMINÉE]'),
              duration: this.calcDur(s.DateTimeStart || s.dateTimeStart, s.DateTimeEnd || s.dateTimeEnd)
            };
          }).sort((a, b) => new Date(a.dateTimeStart || a.DateTimeStart).getTime() - new Date(b.dateTimeStart || b.DateTimeStart).getTime());

        this.filteredCourses = [...this.courses];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  addNewSession() {
    this.isEditing = false;
    this.editingSessionId = null;
    this.newSessionTitle = '';
    this.sessionData.selectedActivityIds = [];
    this.repeatWeeks = 0;
    this.isModalOpen = true;
  }

  async editSession(course: any) {
    this.isEditing = true;
    this.editingSessionId = course.id || course.Id;
    this.newSessionTitle = (course.name || "").replace(" [TERMINÉE]", "");

    const activities = course.Activities || course.activities || [];
    this.sessionData.selectedActivityIds = activities.map((a: any) => a.Id || a.id);

    if (activities.length > 0) {
      const firstAct = activities[0];
      if (firstAct.Subject || firstAct.subject) this.selectedType = 'class';
      else if (firstAct.Type || firstAct.type) this.selectedType = 'sport';
      else this.selectedType = 'extra';

      // Mapping des données existantes vers le formulaire
      this.sessionData.subject = firstAct.Subject || firstAct.subject || '';
      this.sessionData.teacher = firstAct.Teacher || firstAct.teacher || '';
      this.sessionData.room = firstAct.Room || firstAct.room || '';
      this.sessionData.type = firstAct.Type || firstAct.type || '';
      this.sessionData.place = firstAct.Place || firstAct.place || '';
      this.sessionData.intensity = firstAct.Intensity || firstAct.intensity || 'Medium';
      this.sessionData.organiser = firstAct.Organiser || firstAct.organiser || '';
      this.sessionData.theme = firstAct.Theme || firstAct.theme || '';
    }

    const start = new Date(course.DateTimeStart || course.dateTimeStart);
    this.selectedStartDate = start.toISOString().split('T')[0];
    this.selectedStartTime = start.toTimeString().split(' ')[0].substring(0, 5);

    const end = new Date(course.DateTimeEnd || course.dateTimeEnd);
    this.selectedDuration = Math.round((end.getTime() - start.getTime()) / 60000);

    this.isModalOpen = true;
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim()) return;
    const loading = await this.loadingCtrl.create({ message: 'SYNCHRONISATION...' });
    await loading.present();

    const start = new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`);
    const end = new Date(start.getTime() + (this.selectedDuration * 60000));

    let activityObs: Observable<any>;
    const activityId = this.isEditing ? this.sessionData.selectedActivityIds[0] : 0;

    const activityBody: any = {
      Id: activityId,
      Name: this.newSessionTitle,
      Description: this.sessionData.description
    };

    if (this.selectedType === 'class') {
      const body = { ...activityBody, Subject: this.sessionData.subject, Teacher: this.sessionData.teacher, Room: this.sessionData.room, Objective: "Mission Nexus" };
      activityObs = (this.isEditing && activityId) ? this.nexusService.updateClass(activityId, body) : this.nexusService.createClass(body);
    } else if (this.selectedType === 'sport') {
      const body = { ...activityBody, Type: this.sessionData.type, Place: this.sessionData.place, Intensity: this.sessionData.intensity, Duration: Number(this.selectedDuration) };
      activityObs = (this.isEditing && activityId) ? this.nexusService.updateSport(activityId, body) : this.nexusService.createSport(body);
    } else {
      const body = { ...activityBody, Organiser: this.sessionData.organiser, Place: this.sessionData.place || 'Zone Nexus', Theme: this.sessionData.theme, Resource: "Web" };
      activityObs = (this.isEditing && activityId) ? this.nexusService.updateExtra(activityId, body) : this.nexusService.createExtra(body);
    }

    activityObs.subscribe({
      next: (res) => {
        const sessionPayload: any = {
          Id: this.isEditing ? this.editingSessionId : 0,
          DateTimeStart: start.toISOString(),
          DateTimeEnd: end.toISOString(),
          Status: this.newSessionTitle,
          LoginId: 7,
          ActivityIds: [res.Id || res.id]
        };

        const sessionReq = this.isEditing
          ? this.nexusService.updateSession(this.editingSessionId, sessionPayload)
          : this.nexusService.createSession(sessionPayload);

        sessionReq.subscribe({
          next: () => {
            loading.dismiss();
            this.isModalOpen = false;
            this.loadSchedule(false);
            this.nexusService.showToast(this.isEditing ? 'MIS À JOUR' : 'CRÉÉ');
          },
          error: () => loading.dismiss()
        });
      },
      error: () => {
        loading.dismiss();
        this.nexusService.showToast('ERREUR ACTIVITÉ');
      }
    });
  }

  async presentActionSheet(course: any) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'MISSION: ' + course.name.toUpperCase(),
      buttons: [
        { text: 'Modifier', icon: 'create-outline', handler: () => { this.editSession(course); } },
        {
          text: 'Supprimer',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.nexusService.deleteSession(course.id || course.Id).subscribe(() => this.loadSchedule(false));
            return true;
          }
        },
        { text: 'Annuler', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  validateSession(course: any, event: any) {
    event.stopPropagation();
    const tag = " [TERMINÉE]";
    const newStatus = course.isDone ? course.name.replace(tag, "") : course.name + tag;

    const payload = {
      Id: course.id || course.Id,
      Status: newStatus,
      DateTimeStart: course.DateTimeStart || course.dateTimeStart,
      DateTimeEnd: course.DateTimeEnd || course.dateTimeEnd,
      LoginId: 7
    };

    this.nexusService.updateSession(payload.Id, payload).subscribe({
      next: () => this.loadSchedule(false),
      error: () => this.nexusService.showToast('ERREUR VALIDATION')
    });
  }

  onSearch(event: any) {
    const val = event.target.value.toLowerCase();
    this.filteredCourses = this.courses.filter(c => c.name.toLowerCase().includes(val));
  }

  private formatTime(d: string) {
    return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  }

  private calcDur(s: string, e: string) {
    const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000);
    return diff >= 60 ? `${Math.floor(diff/60)}h${diff%60 || ''}` : `${diff}m`;
  }
}
