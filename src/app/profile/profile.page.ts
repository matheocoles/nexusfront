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

  userData: any = null;
  isEditing: boolean = false;
  isLoading: boolean = true;
  newPassword: string = "";
  showPassword = false;
  isWorking = false;

  days: number = 0;
  hours: number = 0;
  minutes: number = 0;
  progress: number = 0;
  private timerInterval: any;

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
    this.checkCurrentSession();

    // Simulation de chargement initial
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 800);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  loadProfileData() {
    const token = localStorage.getItem('nexus_token');
    const savedAvatar = localStorage.getItem('nexus_avatar');
    const savedSection = localStorage.getItem('nexus_section');
    const localFullName = localStorage.getItem('nexus_fullname');

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);

      // Correction ici : On récupère le username du token en priorité
      // Certains serveurs utilisent 'unique_name', d'autres 'sub' ou 'Username'
      const tokenUsername = decoded.unique_name || decoded.sub || decoded.Username || 'nexus_user';

      // On ne recrée l'objet que s'il n'existe pas déjà pour éviter d'écraser les saisies en cours
      this.userData = {
        id: decoded.UserId || decoded.nameid || '0',
        fullName: localFullName || decoded.FullName || 'Membre Nexus',
        username: tokenUsername, // On fixe le username une bonne fois pour toutes
        section: savedSection || 'Étudiant Nexus',
        avatarUrl: savedAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenUsername}`
      };
    } catch (e) {
      console.error("Erreur décodage token", e);
      this.router.navigate(['/login']);
    }
  }

  async saveChanges() {
    if (!this.userData) return;

    const loading = await this.loadingController.create({
      message: 'Synchronisation Nexus...',
      spinner: 'crescent'
    });
    await loading.present();

    const updateData: any = {
      id: parseInt(this.userData.id, 10),
      username: this.userData.username, // On renvoie bien le username stocké
      fullName: this.userData.fullName
    };

    if (this.newPassword.trim()) {
      updateData.password = this.newPassword;
    }

    this.nexusService.updateUser(this.userData.id, updateData).subscribe({
      next: () => {
        // On sauvegarde les nouvelles valeurs localement
        localStorage.setItem('nexus_section', this.userData.section);
        localStorage.setItem('nexus_fullname', this.userData.fullName);

        loading.dismiss();
        this.isEditing = false;
        this.newPassword = "";
        this.nexusService.showToast("Profil synchronisé");

        // IMPORTANT : On ne rappelle PAS loadProfileData() ici,
        // car le token contient toujours les ANCIENNES valeurs.
        // L'objet userData est déjà à jour dans la vue grâce au ngModel.
      },
      error: (err) => {
        loading.dismiss();
        this.nexusService.showToast("Échec de la liaison au serveur");
      }
    });
  }

  checkCurrentSession() {
    this.nexusService.getSessions().subscribe({
      next: (sessions) => {
        const now = new Date();
        this.isWorking = sessions.some(s => {
          const start = new Date(s.dateTimeStart);
          const end = new Date(s.dateTimeEnd);
          return now >= start && now <= end;
        });
        this.cdr.detectChanges();
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

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.floor((now - startTimestamp) / 1000);
      this.days = Math.floor(diff / 86400);
      this.hours = Math.floor((diff % 86400) / 3600);
      this.minutes = Math.floor((diff % 3600) / 60);
      this.progress = (diff % 86400) / 86400;
      this.cdr.detectChanges();
    };

    updateTimer();
    this.timerInterval = setInterval(updateTimer, 60000); // Mise à jour par minute pour la performance
  }

  changeAvatar() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        this.nexusService.showToast("Image trop lourde (max 2Mo)");
        return;
      }
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

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.newPassword = "";
      this.loadProfileData(); // Reset si annulation
    }
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
