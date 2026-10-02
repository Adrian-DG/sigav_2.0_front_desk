import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthenticatedResponse, LoginRequest, SesionViewModel } from '../models/auth.model';

const TOKEN_KEY = 'sigav.token';
const TOKEN_EXPIRATION_KEY = 'sigav.tokenExpiration';

/**
 * Sesión del front desk: token de audiencia "web" (Authentication/login) + identidad obtenida de
 * GET /authentication/sesion. El token vive en localStorage (sobrevive a cerrar la pestaña);
 * sesion() solo vive en memoria y se vuelve a pedir al recargar la app (ver AppComponent/APP_INITIALIZER).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sesionSignal = signal<SesionViewModel | null>(null);
  readonly sesion = this.sesionSignal.asReadonly();

  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly token = this.tokenSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly permisos = computed(() => this.sesionSignal()?.permisos ?? []);

  hasPermission(permiso: string): boolean {
    return this.permisos().includes(permiso);
  }

  login(request: LoginRequest): Observable<AuthenticatedResponse> {
    return this.http.post<AuthenticatedResponse>(`${environment.apiUrl}/authentication/login`, request).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(TOKEN_EXPIRATION_KEY, response.expiration);
        this.tokenSignal.set(response.token);
      }),
    );
  }

  /** Hidrata sesion() desde el token ya guardado. Si el token venció o es inválido, el 401 limpia la sesión (ver error.interceptor). */
  cargarSesion(): Observable<SesionViewModel> {
    return this.http
      .get<SesionViewModel>(`${environment.apiUrl}/authentication/sesion`)
      .pipe(tap((sesion) => this.sesionSignal.set(sesion)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRATION_KEY);
    this.tokenSignal.set(null);
    this.sesionSignal.set(null);
    this.router.navigateByUrl('/login');
  }
}
