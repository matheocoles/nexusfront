import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent]
})
export class SplashPage implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    // 1. On laisse l'animation se jouer (ex: 3 secondes)
    setTimeout(() => {
      this.checkRoute();
    }, 3000);
  }

  checkRoute() {
    const isAuthenticated = !!localStorage.getItem('auth_token');

    if (isAuthenticated) {
      this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
