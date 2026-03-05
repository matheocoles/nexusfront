import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle, IonList, IonItem, IonLabel, IonNote
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle, IonList, IonItem, IonLabel, IonNote],
})
export class HomePage {
  constructor() {}
}
