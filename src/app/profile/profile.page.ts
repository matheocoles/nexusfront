import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon]
})
export class ProfilePage implements OnInit {
  private http = inject(HttpClient);
  userData: any = null;

  private apiUrl = '/api/User';
  ngOnInit() {
    this.loadProfileData();
  }

  loadProfileData() {
    this.http.get(this.apiUrl).subscribe({
      next: (data: any) => {
        this.userData = data;
        console.log('Données Nexus chargées !', data);
      },
      error: (err) => {
        console.error('Erreur de route. Code :', err.status);
        console.log('Vérifie dans Swagger le nom exact après le bouton bleu GET');
      }
    });
  }
}
