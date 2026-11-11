import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Agrega el Bearer token a toda petición dirigida a la API (nunca a recursos de otros orígenes).
 * El login va sin token: así un 401 por contraseña incorrecta al renovar la sesión no se confunde
 * con una sesión vencida (error.interceptor cierra la sesión solo si la petición llevaba token).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();

  if (!token || !req.url.startsWith(environment.apiUrl) || req.url === `${environment.apiUrl}/authentication/login`)
    return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
