import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, LoadingController, ActionSheetController } from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline, playOutline, bookOutline, fitnessOutline,
  rocketOutline, checkmarkCircle, locationOutline, trashOutline, closeOutline,
  shieldCheckmarkOutline, chevronBackOutline, chevronForwardOutline, ellipseOutline, layersOutline
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
  isLoading = true; // Loader actif au début
  isModalOpen = false;

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
      'ellipse-outline': ellipseOutline, 'layers-outline': layersOutline
    });
  }

  ngOnInit() { this.loadSchedule(true); } // showLoader = true

  nextDay() {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.updateDateLabel();
    this.loadSchedule(false); // Silent load
  }

  prevDay() {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.updateDateLabel();
    this.loadSchedule(false); // Silent load
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

  async confirmSave() {
    if (!this.newSessionTitle.trim()) return;
    const loading = await this.loadingCtrl.create({ message: 'INJECTION...' });
    await loading.present();

    const start = new Date(`${this.selectedStartDate}T${this.selectedStartTime}:00`);
    const end = new Date(start.getTime() + (this.selectedDuration * 60000));
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

    const base = { Name: this.newSessionTitle, Description: this.sessionData.description, DateTimeStart: isoStart, DateTimeEnd: isoEnd, Activities: [] };
    let createObs;

    if (this.selectedType === 'class') createObs = this.nexusService.createClass({ ...base, Subject: this.newSessionTitle, Teacher: this.sessionData.teacher, Room: this.sessionData.room, Objective: 'Nexus' });
    else if (this.selectedType === 'sport') createObs = this.nexusService.createSport({ ...base, Type: 'Training', Place: this.sessionData.place, Duration: this.selectedDuration, Intensity: this.sessionData.intensity });
    else createObs = this.nexusService.createExtra({ ...base, Organiser: this.sessionData.organiser, Place: this.sessionData.place, Theme: this.sessionData.theme, Resource: 'Web' });

    createObs.subscribe({
      next: (ent: any) => this.injectSession(ent.id, loading, isoStart, isoEnd),
      error: () => this.fallbackToExisting(loading, isoStart, isoEnd)
    });
  }

  private injectSession(catId: number, loading: any, start: string, end: string) {
    const payload = {
      Status: this.newSessionTitle, DateTimeStart: start, DateTimeEnd: end,
      LoginId: parseInt(this.nexusService.getUserId() || '0'),
      ClassId: this.selectedType === 'class' ? catId : null,
      SportId: this.selectedType === 'sport' ? catId : null,
      ExtraActivityId: this.selectedType === 'extra' ? catId : null,
      SessionAchievements: []
    };
    this.nexusService.createSession(payload).subscribe(() => {
      loading.dismiss(); this.isModalOpen = false; this.loadSchedule(false);
    });
  }

  private fallbackToExisting(loading: any, start: string, end: string) {
    const obs = this.selectedType === 'class' ? this.nexusService.getClasses() : this.selectedType === 'sport' ? this.nexusService.getSports() : this.nexusService.getExtra();
    obs.subscribe(items => {
      const ex = items.find(i => i.name.toLowerCase() === this.newSessionTitle.toLowerCase());
      if (ex) this.injectSession(ex.id, loading, start, end); else loading.dismiss();
    });
  }

  validateSession(course: any, event: any) {
    event.stopPropagation(); course.isDone = true;
    this.nexusService.updateSession(course.id, { ...course, status: course.name + " [TERMINÉE]" }).subscribe();
  }

  onSearch(event: any) {
    const val = event.target.value.toLowerCase();
    this.filteredCourses = this.courses.filter(c => c.name.toLowerCase().includes(val));
  }

  addNewSession() { this.newSessionTitle = ''; this.isModalOpen = true; }
  private formatTime(d: string) { return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
  private calcDur(s: string, e: string) { const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000); return diff >= 60 ? `${Math.floor(diff/60)}h${diff%60 || ''}` : `${diff}m`; }

  async presentActionSheet(course: any) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'ACTIONS',
      buttons: [
        {
          text: 'Supprimer', icon: 'trash-outline', role: 'destructive',
          handler: () => {
            this.nexusService.deleteSession(course.id).subscribe(() => this.loadSchedule(false));
          }
        },
        { text: 'Annuler', role: 'cancel' }
      ]
    });
    await sheet.present();
  }
}
