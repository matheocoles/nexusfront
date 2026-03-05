import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('nexus_token');

  if (token) {
    // L'utilisateur est connecté, on le laisse passer
    return true;
  } else {
    // Pas de jeton ? Retour à la case départ (Login)
    router.navigate(['/login']);
    return false;
  }
};
