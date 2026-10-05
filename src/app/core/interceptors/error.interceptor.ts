import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../models/api-error';
import { AuthService } from '../services/auth.service';

/**
 * Traduce cada HttpErrorResponse al { message, errors } que escribe ApiExceptionHandler.cs, y
 * cierra la sesión si un 401 llega para una petición que sí llevaba token (sesión vencida o
 * revocada). Un 401 del propio login (credenciales inválidas) no lleva token todavía, así que no
 * dispara logout: solo se propaga el ApiError para que el formulario lo muestre.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      // Con status 0 no hubo respuesta: error.error es el TypeError/ProgressEvent del navegador
      // (su .message, p. ej. "Failed to fetch", no es un mensaje de la API)
      const body =
        error.status === 0 ? null : (error.error as { message?: string; errors?: Record<string, string[]> } | null);
      const message =
        (typeof body?.message === 'string' && body.message) ||
        (error.status === 0
          ? 'No hay conexión con el servidor. Verifique su red e intente de nuevo.'
          : error.status >= 500
            ? 'El servidor no está disponible en este momento. Intente de nuevo en unos minutos.'
            : `La solicitud falló con estado ${error.status}.`);

      if (error.status === 401 && req.headers.has('Authorization')) auth.logout();

      return throwError(() => new ApiError(error.status, message, body?.errors ?? null));
    }),
  );
};
