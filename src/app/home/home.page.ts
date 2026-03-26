import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, LoadingController, ActionSheetController } from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import { forkJoin, of } from 'rxjs';
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
  editingSessionId: number | null = null;
  repeatWeeks = 0; // 0 = une fois, 1 = 2 semaines, etc.

  currentDate: Date = new Date();
  displayDateLabel = "Aujourd'hui";
  selectedStartDate: string = new Date().toISOString().split('T')[0];
  selectedStartTime: string = "08:00";

  newSessionTitle = '';
  selectedType = 'class';
  selectedDuration = 60;
  sessionData = { description: 'Mission Nexus', teacher: 'Core', room: 'S-1', place: 'Nexus Base', intensity: 'Medium', organiser: 'Nexus', theme: 'Dev' };

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
    this.editingSessionId = course.id;
    this.newSessionTitle = course.name;

    const start = new Date(course.dateTimeStart);
    this.selectedStartDate = start.toISOString().split('T')[0];
    this.selectedStartTime = start.toTimeString().split(' ')[0].substring(0, 5);

    const diff = Math.round((new Date(course.dateTimeEnd).getTime() - start.getTime()) / 60000);
    this.selectedDuration = diff;

    this.selectedType = course.classId ? 'class' : (course.sportId ? 'sport' : 'extra');
    this.isModalOpen = true;
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim()) return;
    const loading = await this.loadingCtrl.create({
      message: this.isEditing ? 'MISE À JOUR...' : 'INJECTION...'
    });
    await loading.present();

    const startBase = new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`);
    const iterations = this.isEditing ? 0 : this.repeatWeeks;
    const requests = [];

    for (let i = 0; i <= iterations; i++) {
      const start = new Date(startBase.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      const end = new Date(start.getTime() + (this.selectedDuration * 60000));

      const payload = {
        Status: this.newSessionTitle,
        DateTimeStart: start.toISOString(),
        DateTimeEnd: end.toISOString(),
        LoginId: parseInt(this.nexusService.getUserId() || '0'),
        ClassId: this.isEditing ? this.courses.find(c => c.id === this.editingSessionId).classId : null,
        SportId: this.isEditing ? this.courses.find(c => c.id === this.editingSessionId).sportId : null,
        ExtraActivityId: this.isEditing ? this.courses.find(c => c.id === this.editingSessionId).extraActivityId : null
      };

      if (this.isEditing) {
        requests.push(this.nexusService.updateSession(this.editingSessionId!, payload));
      } else {
        // Logique simplifiée : on crée la session directement
        // Si tu veux recréer l'entité parente (Class/Sport), il faudrait wrapper dans un forkJoin complexe
        requests.push(this.nexusService.createSession(payload));
      }
    }

    forkJoin(requests).subscribe({
      next: () => {
        loading.dismiss();
        this.isModalOpen = false;
        this.loadSchedule(false);
      },
      error: () => loading.dismiss()
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
