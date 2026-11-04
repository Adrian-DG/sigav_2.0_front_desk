import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Bloquea rutas protegidas sin sesión. Recuerda la página pedida para volver a ella tras el login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;

  return inject(Router).createUrlTree(['/login'], {
    queryParams: state.url && state.url !== '/' ? { volver: state.url } : {},
  });
};
