import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonDatetime, IonList, IonItem, IonLabel, IonBadge,
  IonNote, IonSpinner, IonIcon, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, addOutline, locationOutline,
  calendarOutline, closeOutline, checkmarkOutline
} from 'ionicons/icons';
import { NexusService } from '../services/nexus.service';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonDatetime, IonIcon, IonModal, IonSpinner
  ]
})
export class SchedulePage implements OnInit {
  protected nexusService = inject(NexusService);

  // États de la page
  selectedDate: string = new Date().toISOString();
  allSessions: any[] = [];
  filteredSessions: any[] = [];
  isLoading = true;

  // États de la Popup
  isModalOpen = false;
  isAdding = false;

  // Modèle pour le formulaire
  newSession = {
    name: '',
    room: '',
    startTime: '',
    endTime: '',
    type: 'Cours'
  };

  constructor() {
    addIcons({
      searchOutline, addOutline, locationOutline,
      calendarOutline, closeOutline, checkmarkOutline
    });
  }

  ngOnInit() {
    this.loadData();
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

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.filterSessions();
    this.isModalOpen = true; // Ouvre la popup au clic sur un jour
  }

  filterSessions() {
    const selectedDateObj = new Date(this.selectedDate);
    this.filteredSessions = this.allSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return (
        sessionDate.getFullYear() === selectedDateObj.getFullYear() &&
        sessionDate.getMonth() === selectedDateObj.getMonth() &&
        sessionDate.getDate() === selectedDateObj.getDate()
      );
    });
  }

  submitNewSession() {
    const userId = this.nexusService.getUserId(); // On récupère ton ID stocké au login

    if (!userId || !this.newSession.startTime) {
      console.error("Utilisateur non connecté ou heure manquante");
      return;
    }

    const datePart = this.selectedDate.split('T')[0];

    // On respecte EXACTEMENT les noms de ton modèle C# (DateTimeStart / DateTimeEnd)
    const sessionToSave = {
      dateTimeStart: `${datePart}T${this.newSession.startTime}:00`,
      dateTimeEnd: `${datePart}T${this.newSession.endTime}:00`,
      status: "Prévu",
      loginId: parseInt(userId),
      classId: null,
      sportId: null,
      extraActivityId: null
    };

    this.nexusService.createSession(sessionToSave).subscribe({
      next: () => {
        this.isAdding = false;
        this.loadData();
        this.newSession = { name: '', room: '', startTime: '', endTime: '', type: 'Cours' };
      },
      error: (err) => console.error('Erreur API :', err)
    });
  }
}
