import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonIcon,
  IonSpinner, AlertController, IonInput, IonProgressBar, LoadingController
} from '@ionic/angular/standalone';

import { NexusService } from "../services/nexus.service";
import { addIcons } from 'ionicons';
import {
  personCircleOutline, shieldCheckmarkOutline, logOutOutline, fingerPrintOutline,
  createOutline, closeOutline, checkmarkCircleOutline, cameraOutline // AJOUTÉ
} from 'ionicons/icons';
import { jwtDecode } from "jwt-decode";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  providers: [DecimalPipe],
  imports: [
    CommonModule, FormsModule, IonContent, IonIcon, IonSpinner, IonCard,
    IonCardContent, IonButton, IonInput, IonProgressBar
  ]
})
export class ProfilePage implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  private nexusService = inject(NexusService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  userData: any = null;
  isEditing: boolean = false;
  isLoading: boolean = true; // Pour le Splash Screen Cyberpunk
  newPassword: string = "";

  // Timer States
  days: number = 0;
  hours: number = 0;
  minutes: number = 0;
  seconds: number = 0;
  progress: number = 0;
  timerInterval: any;

  constructor() {
    addIcons({
      'person-circle-outline': personCircleOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'log-out-outline': logOutOutline,
      'finger-print-outline': fingerPrintOutline,
      'create-outline': createOutline,
      'close-outline': closeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'camera-outline': cameraOutline // FIX : Correction erreur URL constructor
    });
  }

  ngOnInit() {
    this.loadProfileData();
    this.initPersistentTimer();

    // Simulation du boot système Nexus (Cyber-Loader)
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // --- GESTION AVATAR ---
  changeAvatar() {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Image = reader.result as string;
        this.userData.avatarUrl = base64Image;
        localStorage.setItem('nexus_avatar', base64Image);
        this.nexusService.showToast("Profil visuel synchronisé");
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  // --- TIMER SYSTÈME ---
  initPersistentTimer() {
    let startTime = localStorage.getItem('nexus_start_time');
    if (!startTime) {
      startTime = new Date().getTime().toString();
      localStorage.setItem('nexus_start_time', startTime);
    }

    const startTimestamp = parseInt(startTime);
    this.updateTimerDisplay(startTimestamp);

    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay(startTimestamp);
      this.cdr.detectChanges();
    }, 1000);
  }

  updateTimerDisplay(startTime: number) {
    const now = new Date().getTime();
    const diffInSeconds = Math.floor((now - startTime) / 1000);

    this.days = Math.floor(diffInSeconds / 86400);
    this.hours = Math.floor((diffInSeconds % 86400) / 3600);
    this.minutes = Math.floor((diffInSeconds % 3600) / 60);
    this.seconds = diffInSeconds % 60;
    this.progress = (diffInSeconds % 86400) / 86400;
  }

  // --- DATA LOADING ---
  loadProfileData() {
    const token = localStorage.getItem('nexus_token');
    const savedAvatar = localStorage.getItem('nexus_avatar');

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      const userId = decoded.UserId || decoded.nameid || decoded.id || '0';
      const fullName = decoded.FullName || decoded.unique_name || 'Membre Nexus';
      const userName = decoded.unique_name || 'nexus_user';

      this.userData = {
        id: userId,
        fullName: fullName,
        username: userName,
        // Fallback sur DiceBear (Robots) si pas d'avatar stocké
        avatarUrl: savedAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userName}`
      };
    } catch (e) {
      console.error("Erreur de décodage", e);
      this.router.navigate(['/login']);
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.newPassword = "";
  }

  async saveChanges() {
    if (!this.userData) return;

    const loading = await this.loadingController.create({
      message: 'Mise à jour du protocole...',
      spinner: 'crescent'
    });
    await loading.present();

    const updateData = {
      id: parseInt(this.userData.id, 10),
      username: this.userData.username,
      fullName: this.userData.fullName,
      password: this.newPassword || undefined
    };

    this.nexusService.updateUser(this.userData.id, updateData).subscribe({
      next: () => {
        loading.dismiss();
        this.isEditing = false;
        this.newPassword = "";
        this.nexusService.showToast("Profil synchronisé");
        this.loadProfileData();
      },
      error: (err) => {
        loading.dismiss();
        console.error("Erreur update", err);
        this.nexusService.showToast("Erreur de synchronisation");
      }
    });
  }

  async handleLogout() {
    const alert = await this.alertController.create({
      header: 'DÉCONNEXION',
      message: 'Voulez-vous couper la liaison Nexus ?',
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'ANNULER', role: 'cancel' },
        {
          text: 'CONFIRMER',
          handler: () => {
            this.nexusService.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}
