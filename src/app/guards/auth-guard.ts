import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('nexus_token');

  if (token) {
    return true; // L'utilisateur a un token, il peut passer
  } else {
    // Pas de token, on le renvoie vers le login
    return router.parseUrl('/login');
  }
};
