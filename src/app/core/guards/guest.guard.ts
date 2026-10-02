import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Saca de /login a quien ya tiene sesión, en vez de mostrarle el formulario de nuevo. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return true;

  return inject(Router).createUrlTree(['/']);
};
