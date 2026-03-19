import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonModal,
  LoadingController, ActionSheetController
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {
  addOutline, searchOutline, menuOutline, playOutline,
  bookOutline, fitnessOutline, rocketOutline, checkmarkCircleOutline,
  checkmarkCircle, locationOutline, trashOutline, createOutline,
  closeOutline, shieldCheckmarkOutline
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
  isEditMode = false;
  isNotifOpen = false;

  newSessionTitle = '';
  selectedType = 'class';
  selectedDuration = 60;

  sessionData = {
    description: 'Mission Nexus Auto-générée',
    teacher: 'Nexus Core',
    room: 'Secteur-A1',
    place: 'Base Nexus',
    intensity: 'Medium',
    organiser: 'Nexus Corp',
    theme: 'Opération Alpha'
  };

  notifTitle = ''; notifMsg = '';
  private palette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85'];

  constructor() {
    addIcons({
      'add-outline': addOutline, 'search-outline': searchOutline,
      'menu-outline': menuOutline, 'play-outline': playOutline,
      'book-outline': bookOutline, 'fitness-outline': fitnessOutline,
      'rocket-outline': rocketOutline, 'checkmark-circle-outline': checkmarkCircleOutline,
      'checkmark-circle': checkmarkCircle, 'location-outline': locationOutline,
      'trash-outline': trashOutline, 'create-outline': createOutline,
      'close-outline': closeOutline, 'shield-checkmark-outline': shieldCheckmarkOutline
    });
  }

  ngOnInit() { this.loadSchedule(); }

  loadSchedule() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (res) => {
        this.courses = res.map((s, i) => ({
          ...s,
          name: s.status || 'Mission',
          room: s.class?.room || s.sport?.place || s.extraActivity?.place || 'Zone Nexus',
          startTime: this.formatTime(s.dateTimeStart),
          endTime: this.formatTime(s.dateTimeEnd),
          displayColor: this.palette[i % this.palette.length],
          isDone: s.status?.includes('[TERMINÉE]'),
          duration: this.calcDur(s.dateTimeStart, s.dateTimeEnd)
        }));
        this.filteredCourses = [...this.courses];
        setTimeout(() => { this.isLoading = false; this.cdr.detectChanges(); }, 1200);
      },
      error: () => { this.isLoading = false; }
    });
  }

  async confirmSave() {
    if (!this.newSessionTitle.trim()) return;
    const loading = await this.loadingCtrl.create({ message: 'COMMUNICATION RAILWAY...' });
    await loading.present();

    const now = new Date().toISOString();
    const durationNum = parseInt(this.selectedDuration.toString(), 10);
    const endTime = new Date(Date.now() + (durationNum * 60000)).toISOString();

    // Modèle Activity (Base)
    const baseActivity = {
      Name: this.newSessionTitle,
      Description: this.sessionData.description || "Mission Nexus",
      DateTimeStart: now,
      DateTimeEnd: endTime,
      Activities: []
    };

    let createObs;

    if (this.selectedType === 'class') {
      const payload = { ...baseActivity, Subject: this.newSessionTitle, Teacher: this.sessionData.teacher, Room: this.sessionData.room, Objective: 'Objectif Standard' };
      createObs = this.nexusService.createClass(payload);
    } else if (this.selectedType === 'sport') {
      const payload = { ...baseActivity, Type: 'Training', Place: this.sessionData.place, Duration: durationNum, Intensity: this.sessionData.intensity };
      createObs = this.nexusService.createSport(payload);
    } else {
      const payload = { ...baseActivity, Organiser: this.sessionData.organiser, Place: this.sessionData.place, Theme: this.sessionData.theme, Resource: 'Terminal Nexus' };
      createObs = this.nexusService.createExtra(payload);
    }

    createObs.subscribe({
      next: (newEntity: any) => this.injectSession(newEntity.id, loading, now, endTime),
      error: () => {
        // Fallback si l'entité existe déjà (évite la 500/400 sur doublon)
        this.fallbackToExisting(loading, now, endTime);
      }
    });
  }

  private fallbackToExisting(loading: any, start: string, end: string) {
    const listObs = this.selectedType === 'class' ? this.nexusService.getClasses() :
      this.selectedType === 'sport' ? this.nexusService.getSports() : this.nexusService.getExtra();

    listObs.subscribe((items: any[]) => {
      const existing = items.find(i => i.name.toLowerCase() === this.newSessionTitle.toLowerCase());
      if (existing) {
        this.injectSession(existing.id, loading, start, end);
      } else {
        loading.dismiss();
        this.nexusService.showToast("ERREUR : Liaison impossible");
      }
    });
  }

  private injectSession(catId: number, loading: any, start: string, end: string) {
    const payload = {
      Status: this.newSessionTitle,
      DateTimeStart: start,
      DateTimeEnd: end,
      LoginId: parseInt(this.nexusService.getUserId() || '0'),
      ClassId: this.selectedType === 'class' ? catId : null,
      SportId: this.selectedType === 'sport' ? catId : null,
      ExtraActivityId: this.selectedType === 'extra' ? catId : null,
      SessionAchievements: []
    };

    this.nexusService.createSession(payload).subscribe({
      next: () => {
        loading.dismiss();
        this.isModalOpen = false;
        this.loadSchedule();
        this.showHUD('SYNC OK', 'MISSION ENREGISTRÉE');
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur Session 400:", err.error);
        this.nexusService.showToast("ERREUR : Session rejetée");
      }
    });
  }

  // --- ACTIONS ---
  validateSession(course: any, event: any) {
    event.stopPropagation();
    course.isDone = true;
    this.nexusService.updateSession(course.id, { ...course, status: course.name + " [TERMINÉE]" }).subscribe();
    this.showHUD('TERMINÉ', '+100 XP');
  }

  onSearch(event: any) {
    const val = event.target.value.toLowerCase();
    this.filteredCourses = this.courses.filter(c => c.name.toLowerCase().includes(val));
  }

  addNewSession() {
    this.isEditMode = false;
    this.newSessionTitle = '';
    this.isModalOpen = true;
  }

  showHUD(t: string, m: string) {
    this.notifTitle = t; this.notifMsg = m; this.isNotifOpen = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.isNotifOpen = false; this.cdr.detectChanges(); }, 2000);
  }

  async presentActionSheet(course: any) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'ACTIONS',
      buttons: [
        { text: 'Supprimer', icon: 'trash-outline', role: 'destructive', handler: () => {
            this.nexusService.deleteSession(course.id).subscribe(() => this.loadSchedule());
          }},
        { text: 'Annuler', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private formatTime(d: string) { return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
  private calcDur(s: string, e: string) {
    const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000);
    return diff >= 60 ? `${Math.floor(diff/60)}h${diff%60 || ''}` : `${diff}m`;
  }
}
