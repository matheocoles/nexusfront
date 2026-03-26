import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonDatetime, IonSpinner, IonIcon, IonModal,
  AlertController, LoadingController,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, locationOutline, calendarOutline,
  closeOutline, trashOutline, bookOutline,
  fitnessOutline, rocketOutline, calendarClearOutline,
  timeOutline, checkmarkCircleOutline, repeatOutline
} from 'ionicons/icons';
import { NexusService } from '../services/nexus.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonDatetime, IonIcon,
    IonModal, IonSpinner, IonSegment, IonSegmentButton, IonLabel
  ],
  providers: [DatePipe]
})
export class SchedulePage implements OnInit {
  protected nexusService = inject(NexusService);
  private alertController = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  isReady = false;
  isLoading = true;
  isModalOpen = false;

  selectedDate: string = new Date().toISOString();
  allSessions: any[] = [];
  filteredSessions: any[] = [];
  categoryList: any[] = [];
  highlightedDates: any[] = [];

  currentFilter = 'all';
  selectedType = 'class';
  selectedCategoryId: number | null = null;

  newSession = {
    name: '',
    startTime: '08:00',
    endTime: '09:30',
    repeatWeeks: 0
  };

  constructor() {
    addIcons({ addOutline, locationOutline, calendarOutline, closeOutline, trashOutline, bookOutline, fitnessOutline, rocketOutline, calendarClearOutline, timeOutline, checkmarkCircleOutline, repeatOutline });
  }

  ngOnInit() { this.loadData(); }
  ionViewDidEnter() { this.isReady = true; this.loadData(); }

  loadData() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (data) => {
        this.allSessions = data || [];
        this.generateActivityDots();
        this.filterSessions();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  generateActivityDots() {
    const uniqueDates = [...new Set(this.allSessions.map(s => s.dateTimeStart.split('T')[0]))];

    this.highlightedDates = uniqueDates.map(dateStr => {
      return {
        date: dateStr,
        textColor: '#911F45', // Chiffre en bordeaux
        backgroundColor: 'rgba(145, 31, 69, 0.15)'
      };
    });
  }

  filterSessions() {
    const selStr = new Date(this.selectedDate).toDateString();
    let list = this.allSessions.filter(s => new Date(s.dateTimeStart).toDateString() === selStr);

    if (this.currentFilter !== 'all') {
      if (this.currentFilter === 'class') list = list.filter(s => s.classId);
      if (this.currentFilter === 'sport') list = list.filter(s => s.sportId);
      if (this.currentFilter === 'extra') list = list.filter(s => s.extraActivityId);
    }
    this.filteredSessions = list.sort((a, b) => new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime());
    this.cdr.detectChanges();
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.filterSessions();
  }

  isNow(start: string, end: string): boolean {
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
  }

  getDuration(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.round(((diffMs % 3600000) / 60000));
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}min`;
  }

  openAddModal() {
    this.isModalOpen = true;
    this.loadCategories();
  }

  changeType(type: string) {
    this.selectedType = type;
    this.selectedCategoryId = null;
    this.loadCategories();
  }

  loadCategories() {
    const obs = this.selectedType === 'class' ? this.nexusService.getClasses() :
      this.selectedType === 'sport' ? this.nexusService.getSports() : this.nexusService.getExtra();
    obs.subscribe(data => { this.categoryList = data || []; this.cdr.detectChanges(); });
  }

  async submitNewSession() {
    const uid = typeof this.nexusService.getUserId === 'function' ? this.nexusService.getUserId() : (this.nexusService as any).getUserId;
    if (!uid || !this.selectedCategoryId) return;

    const loader = await this.loadingCtrl.create({ message: 'Sync...', spinner: 'crescent' });
    await loader.present();

    const baseDate = new Date(this.selectedDate);
    const requests = [];

    for (let i = 0; i <= this.newSession.repeatWeeks; i++) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + (i * 7));
      const dateStr = targetDate.toISOString().split('T')[0];

      const payload = {
        dateTimeStart: `${dateStr}T${this.newSession.startTime}:00`,
        dateTimeEnd: `${dateStr}T${this.newSession.endTime}:00`,
        status: this.newSession.name || "Session Nexus",
        loginId: Number(uid),
        classId: this.selectedType === 'class' ? Number(this.selectedCategoryId) : null,
        sportId: this.selectedType === 'sport' ? Number(this.selectedCategoryId) : null,
        extraActivityId: this.selectedType === 'extra' ? Number(this.selectedCategoryId) : null
      };
      requests.push(this.nexusService.createSession(payload));
    }

    forkJoin(requests).subscribe({
      next: () => {
        loader.dismiss();
        this.isModalOpen = false;
        this.loadData();
      },
      error: () => loader.dismiss()
    });
  }

  async deleteSession(id: any, event: Event) {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'SUPPRIMER ?',
      buttons: [
        { text: 'NON', role: 'cancel' },
        { text: 'OUI', handler: () => this.nexusService.deleteSession(id).subscribe(() => this.loadData()) }
      ]
    });
    await alert.present();
  }
}
