import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- INDISPENSABLE pour *ngFor
import {
  IonContent,
  IonCard,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent
  ]
})
export class HomePage  {

  // On peut créer une vraie liste pour tester la boucle
  archives = [
    { title: 'Titre 1', duration: '25 m' },
    { title: 'Titre 2', duration: '10 m' },
    { title: 'Titre 3', duration: '45 m' }
  ];

  constructor() {}


}
