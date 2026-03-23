import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonIcon, IonSpinner, AlertController,
  LoadingController,
} from '@ionic/angular/standalone';

import { NexusService } from "../services/nexus.service";
import { addIcons } from 'ionicons';
import {
  personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline,
  createOutline, closeOutline, checkmarkCircleOutline, cameraOutline,
  eyeOutline, eyeOffOutline, bookOutline, fitnessOutline, rocketOutline,
  timerOutline, cafeOutline, pulseOutline
} from 'ionicons/icons';
import { jwtDecode } from "jwt-decode";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  providers: [DecimalPipe],
  imports: [
    CommonModule, FormsModule, IonContent, IonIcon, IonSpinner,
    IonButton,
  ]
})
export class ProfilePage implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  private nexusService = inject(NexusService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  // Données utilisateur
  userData: any = null;
  isEditing: boolean = false;
  isLoading: boolean = true;
  newPassword: string = "";
  showPassword = false;
  isWorking = false; // Statut session active

  // Paramètres système
  isDarkMode: boolean = true;
  stats = { classes: 0, sports: 0, extras: 0 };

  // Timer States
  days: number = 0;
  hours: number = 0;
  minutes: number = 0;
  progress: number = 0;
  timerInterval: any;

  constructor() {
    addIcons({
      personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline,
      createOutline, closeOutline, checkmarkCircleOutline, cameraOutline,
      eyeOutline, eyeOffOutline, bookOutline, fitnessOutline, rocketOutline,
      timerOutline, cafeOutline, pulseOutline
    });
  }

  ngOnInit() {
    this.loadProfileData();
    this.initPersistentTimer();
    this.loadActivityStats();
    this.checkCurrentSession(); // Vérifie si un cours est en cours
    this.checkTheme();

    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1500);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  loadProfileData() {
    const token = localStorage.getItem('nexus_token');
    const savedAvatar = localStorage.getItem('nexus_avatar');
    const savedSection = localStorage.getItem('nexus_section');

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      this.userData = {
        id: decoded.UserId || decoded.nameid || '0',
        fullName: decoded.FullName || 'Membre Nexus',
        username: decoded.unique_name || 'nexus_user',
        section: savedSection || 'Étudiant Nexus',
        avatarUrl: savedAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${decoded.unique_name}`
      };
    } catch (e) {
      this.router.navigate(['/login']);
    }
  }

  checkCurrentSession() {
    this.nexusService.getSessions().subscribe(sessions => {
      const now = new Date();
      this.isWorking = sessions.some(s => {
        const start = new Date(s.dateTimeStart);
        const end = new Date(s.dateTimeEnd);
        return now >= start && now <= end;
      });
      this.cdr.detectChanges();
    });
  }

  loadActivityStats() {
    this.nexusService.getSessions().subscribe(sessions => {
      this.stats.classes = sessions.filter(s => s.classId).length;
      this.stats.sports = sessions.filter(s => s.sportId).length;
      this.stats.extras = sessions.filter(s => s.extraActivityId).length;
      this.cdr.detectChanges();
    });
  }

  async saveChanges() {
    if (!this.userData) return;

    const loading = await this.loadingController.create({
      message: 'Synchronisation du profil...',
      spinner: 'crescent'
    });
    await loading.present();

    const updateData: any = {
      id: parseInt(this.userData.id, 10),
      username: this.userData.username,
      fullName: this.userData.fullName
    };

    // On n'ajoute le password que s'il est saisi
    if (this.newPassword.trim()) {
      updateData.password = this.newPassword;
    }

    this.nexusService.updateUser(this.userData.id, updateData).subscribe({
      next: () => {
        // Sauvegarde locale du cursus (Section)
        localStorage.setItem('nexus_section', this.userData.section);

        loading.dismiss();
        this.isEditing = false;
        this.newPassword = "";
        this.nexusService.showToast("Profil mis à jour avec succès");
        this.loadProfileData();
      },
      error: () => {
        loading.dismiss();
        this.nexusService.showToast("Erreur lors de l'enregistrement");
      }
    });
  }


  initPersistentTimer() {
    let startTime = localStorage.getItem('nexus_start_time');
    if (!startTime) {
      startTime = new Date().getTime().toString();
      localStorage.setItem('nexus_start_time', startTime);
    }
    const startTimestamp = parseInt(startTime);
    this.timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.floor((now - startTimestamp) / 1000);
      this.days = Math.floor(diff / 86400);
      this.hours = Math.floor((diff % 86400) / 3600);
      this.minutes = Math.floor((diff % 3600) / 60);
      this.progress = (diff % 86400) / 86400;
      this.cdr.detectChanges();
    }, 1000);
  }

  changeAvatar() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.userData.avatarUrl = base64;
        localStorage.setItem('nexus_avatar', base64);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  checkTheme() {
    const theme = localStorage.getItem('nexus_theme');
    this.isDarkMode = theme === 'dark' || !theme;
    document.body.classList.toggle('dark', this.isDarkMode);
  }

  toggleTheme(event: any) {
    this.isDarkMode = event.detail.checked;
    document.body.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('nexus_theme', this.isDarkMode ? 'dark' : 'light');
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.newPassword = "";
  }

  async handleLogout() {
    const alert = await this.alertController.create({
      header: 'DÉCONNEXION',
      message: 'Voulez-vous couper la liaison Nexus ?',
      buttons: [
        { text: 'ANNULER', role: 'cancel' },
        { text: 'CONFIRMER', handler: () => {
            this.nexusService.logout();
            this.router.navigate(['/login']);
          }}
      ]
    });
    await alert.present();
  }
}
