import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Factory de guard: exige un permiso puntual de SesionViewModel.permisos (claims "permission" del
 * JWT web, ver SesionClaims.cs). Uso en rutas: canActivate: [permissionGuard('usuarios.editar')].
 */
export function permissionGuard(permiso: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    if (auth.hasPermission(permiso)) return true;

    return inject(Router).createUrlTree(['/']);
  };
}
