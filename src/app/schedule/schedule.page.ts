import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonDatetime, IonSpinner, IonIcon, IonModal,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, addOutline, locationOutline, calendarOutline,
  closeOutline, checkmarkOutline, trashOutline, bookOutline,
  fitnessOutline, rocketOutline
} from 'ionicons/icons';
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
  private toastController = inject(ToastController);
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
  newSession = { name: '', startTime: '', endTime: '' };

  constructor() {
    addIcons({
      searchOutline, addOutline, locationOutline, calendarOutline,
      closeOutline, checkmarkOutline, trashOutline, bookOutline,
      fitnessOutline, rocketOutline
    });
  }

  ngOnInit() { this.loadData(); }

  ionViewDidEnter() {
    setTimeout(() => { this.isReady = true; }, 100);
  }

  loadData() {
    this.isLoading = true;
    this.nexusService.getSessions().subscribe({
      next: (data) => {
        this.allSessions = data;
        this.filterSessions();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  filterSessions() {
    const selectedDateObj = new Date(this.selectedDate);
    this.filteredSessions = this.allSessions.filter(session => {
      const d = new Date(session.dateTimeStart || session.startTime);
      return d.toDateString() === selectedDateObj.toDateString();
    });
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
    let obs = this.selectedType === 'class' ? this.nexusService.getClasses() :
      this.selectedType === 'sport' ? this.nexusService.getSports() :
        this.nexusService.getExtra();

    obs.subscribe(data => {
      this.categoryList = data;
      this.cdr.detectChanges();
    });
  }

  submitNewSession() {
    const userId = this.nexusService.getUserId();
    if (!userId || !this.newSession.startTime) return;

    const datePart = this.selectedDate.split('T')[0];
    const payload = {
      dateTimeStart: `${datePart}T${this.newSession.startTime}:00`,
      dateTimeEnd: `${datePart}T${this.newSession.endTime}:00`,
      status: this.newSession.name || "Prévu",
      loginId: parseInt(userId),
      classId: this.selectedType === 'class' ? this.selectedCategoryId : null,
      sportId: this.selectedType === 'sport' ? this.selectedCategoryId : null,
      extraActivityId: this.selectedType === 'extra' ? this.selectedCategoryId : null
    };

    this.nexusService.createSession(payload).subscribe({
      next: () => {
        this.isAdding = false;
        this.loadData();
      }
    });
  }

  async deleteSession(id: any, event: Event) {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'SUPPRIMER ?',
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'NON', role: 'cancel' },
        { text: 'OUI', handler: () => {
            this.nexusService.deleteSession(id).subscribe({
              next: () => {
                this.allSessions = this.allSessions.filter(s => s.id !== id);
                this.filterSessions();
                this.cdr.detectChanges();
              }
            });
          }}
      ]
    });
    await alert.present();
  }
}
