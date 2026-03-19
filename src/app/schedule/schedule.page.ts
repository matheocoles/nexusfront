import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonDatetime, IonSpinner, IonIcon, IonModal, AlertController, LoadingController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, addOutline, locationOutline, calendarOutline, closeOutline, checkmarkOutline, trashOutline, bookOutline, fitnessOutline, rocketOutline, calendarClearOutline } from 'ionicons/icons';
import { NexusService } from '../services/nexus.service';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonDatetime, IonIcon, IonModal, IonSpinner]
})
export class SchedulePage implements OnInit {
  protected nexusService = inject(NexusService);
  private alertController = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  isReady = false;
  selectedDate: string = new Date().toISOString();
  allSessions: any[] = [];
  filteredSessions: any[] = [];
  categoryList: any[] = [];
  isLoading = true;
  isModalOpen = false;
  isAdding = false;
  selectedType = 'class';
  selectedCategoryId: number | null = null;
  newSession = { name: '', startTime: '08:00', endTime: '09:00' };

  constructor() {
    addIcons({ searchOutline, addOutline, locationOutline, calendarOutline, closeOutline, checkmarkOutline, trashOutline, bookOutline, fitnessOutline, rocketOutline, calendarClearOutline });
  }

  ngOnInit() { this.loadData(); }
  ionViewDidEnter() { setTimeout(() => { this.isReady = true; this.cdr.detectChanges(); }, 200); }

  loadData() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (data) => {
        this.allSessions = data;
        this.filterSessions();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => this.isLoading = false
    });
  }

  filterSessions() {
    const selStr = new Date(this.selectedDate).toDateString();
    this.filteredSessions = this.allSessions
      .filter(s => new Date(s.dateTimeStart).toDateString() === selStr)
      .sort((a, b) => new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime());
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.filterSessions();
    this.isModalOpen = true;
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
    const obs = this.selectedType === 'class' ? this.nexusService.getClasses() : this.selectedType === 'sport' ? this.nexusService.getSports() : this.nexusService.getExtra();
    obs.subscribe(data => { this.categoryList = data; this.cdr.detectChanges(); });
  }

  async submitNewSession() {
    const uid = this.nexusService.getUserId();
    if (!uid || !this.selectedCategoryId) return;

    const loader = await this.loadingCtrl.create({ message: 'Sync...' });
    await loader.present();

    const date = this.selectedDate.split('T')[0];
    const payload = {
      dateTimeStart: `${date}T${this.newSession.startTime}:00`,
      dateTimeEnd: `${date}T${this.newSession.endTime}:00`,
      status: this.newSession.name || "Prévu",
      loginId: parseInt(uid),
      classId: this.selectedType === 'class' ? this.selectedCategoryId : null,
      sportId: this.selectedType === 'sport' ? this.selectedCategoryId : null,
      extraActivityId: this.selectedType === 'extra' ? this.selectedCategoryId : null
    };

    this.nexusService.createSession(payload).subscribe({
      next: () => { loader.dismiss(); this.isAdding = false; this.loadData(); },
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
