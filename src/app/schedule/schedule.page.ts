import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonDatetime, IonSpinner, IonIcon, IonModal,
  AlertController, LoadingController, IonButton,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, locationOutline, calendarOutline,
  closeOutline, trashOutline, bookOutline,
  fitnessOutline, rocketOutline, calendarClearOutline,
  timeOutline, checkmarkCircleOutline
} from 'ionicons/icons';
import { NexusService } from '../services/nexus.service';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonDatetime, IonIcon,
    IonModal, IonSpinner, IonButton, IonSegment, IonSegmentButton, IonLabel
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
  isAdding = false;
  selectedDate: string = new Date().toISOString();
  allSessions: any[] = [];
  filteredSessions: any[] = [];
  categoryList: any[] = [];
  currentFilter = 'all';
  selectedType = 'class';
  selectedCategoryId: number | null = null;
  newSession = { name: '', startTime: '08:00', endTime: '09:30' };

  constructor() {
    addIcons({ addOutline, locationOutline, calendarOutline, closeOutline, trashOutline, bookOutline, fitnessOutline, rocketOutline, calendarClearOutline, timeOutline, checkmarkCircleOutline });
  }

  ngOnInit() { this.loadData(); }
  ionViewDidEnter() { this.isReady = true; this.loadData(); }

  loadData() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (data) => {
        this.allSessions = data;
        this.filterSessions();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
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
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.filterSessions();
    this.isModalOpen = true;
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

  toggleAdding() {
    this.isAdding = !this.isAdding;
    if (this.isAdding) this.loadCategories();
  }

  changeType(type: string) {
    this.selectedType = type;
    this.selectedCategoryId = null;
    this.loadCategories();
  }

  loadCategories() {
    const obs = this.selectedType === 'class' ? this.nexusService.getClasses() :
      this.selectedType === 'sport' ? this.nexusService.getSports() : this.nexusService.getExtra();
    obs.subscribe(data => { this.categoryList = data; this.cdr.detectChanges(); });
  }

  async submitNewSession() {
    const rawUid = typeof this.nexusService.getUserId === 'function' ? this.nexusService.getUserId() : (this.nexusService as any).getUserId;
    if (!rawUid || !this.selectedCategoryId) return;
    const loader = await this.loadingCtrl.create({ message: 'Sync...', spinner: 'crescent' });
    await loader.present();
    const datePart = this.selectedDate.split('T')[0];
    const payload = {
      dateTimeStart: `${datePart}T${this.newSession.startTime}:00`,
      dateTimeEnd: `${datePart}T${this.newSession.endTime}:00`,
      status: this.newSession.name || "Session Nexus",
      loginId: Number(rawUid),
      classId: this.selectedType === 'class' ? this.selectedCategoryId : null,
      sportId: this.selectedType === 'sport' ? this.selectedCategoryId : null,
      extraActivityId: this.selectedType === 'extra' ? this.selectedCategoryId : null
    };
    this.nexusService.createSession(payload).subscribe({
      next: () => { loader.dismiss(); this.isAdding = false; this.loadData(); this.nexusService.showToast("Ajouté !"); },
      error: () => loader.dismiss()
    });
  }

  async deleteSession(id: any, event: Event) {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Supprimer ?',
      buttons: [{ text: 'Non', role: 'cancel' }, { text: 'Oui', handler: () => this.nexusService.deleteSession(id).subscribe(() => this.loadData()) }]
    });
    await alert.present();
  }
}
