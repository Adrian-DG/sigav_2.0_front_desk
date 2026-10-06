import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Bloquea rutas protegidas sin sesión. Tras el login siempre se entra por el inicio. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;

  return inject(Router).createUrlTree(['/login']);
};
