import { Component, inject, OnInit } from '@angular/core'; // Ajoute inject
import { Platform, IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import {SplashScreen} from "@capacitor/splash-screen";

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  // On injecte la plateforme ici, plus besoin du constructeur pour ça
  private platform = inject(Platform);

  constructor() {}

  async ngOnInit() {
    await this.initializeApp();
    await SplashScreen.show({
      autoHide: true,
      showDuration: 3000
    });
  }

  async initializeApp() {
    await this.platform.ready();

    if (this.platform.is('hybrid')) {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
      } catch (err) {
        console.warn('StatusBar non disponible', err);
      }
    }
  }
}
