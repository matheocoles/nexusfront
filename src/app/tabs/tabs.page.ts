import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import {IonIcon, IonTabBar, IonTabButton, IonTabs} from "@ionic/angular/standalone";

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  imports: [
    IonTabs,
    IonTabButton,
    IonIcon,
    IonTabBar
  ],
  styleUrls: ['tabs.page.scss']
})
export class TabsPage {

  // Propriété pour suivre l'onglet actif si tu veux ajouter des effets de style dynamiques
  activeTab: string = 'home';

  constructor(private navCtrl: NavController) {}

  /**
   * Cette fonction est appelée chaque fois que l'utilisateur change d'onglet.
   * @param event L'événement de changement d'onglet contenant le nom de l'onglet sélectionné.
   */
  setCurrentTab(event: any) {
    this.activeTab = event.tab;
    console.log('Onglet actuel NEXUS :', this.activeTab);
  }

  /**
   * Optionnel : Une méthode pour forcer la navigation vers l'accueil
   * (utile si tu veux ajouter un bouton de retour spécifique dans l'UI)
   */
  goToHome() {
    this.navCtrl.navigateRoot('/tabs/home');
  }

}
