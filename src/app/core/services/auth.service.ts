import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error';
import { AuthenticatedResponse, LoginRequest, SesionViewModel } from '../models/auth.model';

const TOKEN_KEY = 'sigav.token';
const TOKEN_EXPIRATION_KEY = 'sigav.tokenExpiration';
const SESION_KEY = 'sigav.sesion';
/** Usuario con que se inició sesión: para renovarla pidiendo solo la contraseña. */
const USUARIO_KEY = 'sigav.usuario';

/** Token guardado, salvo que ya haya vencido según la expiración que devolvió el login. */
function leerTokenVigente(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiracion = Date.parse(localStorage.getItem(TOKEN_EXPIRATION_KEY) ?? '');
  if (token && !Number.isNaN(expiracion) && expiracion <= Date.now()) {
    limpiarAlmacenamiento();
    return null;
  }
  return token;
}

function leerExpiracion(): number | null {
  const ms = Date.parse(localStorage.getItem(TOKEN_EXPIRATION_KEY) ?? '');
  return Number.isNaN(ms) ? null : ms;
}

/** Última sesión hidratada: permite arrancar con menú y permisos aunque la API no responda. */
function leerSesionGuardada(): SesionViewModel | null {
  try {
    const sesion = JSON.parse(localStorage.getItem(SESION_KEY) ?? 'null') as SesionViewModel | null;
    return sesion && Array.isArray(sesion.permisos) ? sesion : null;
  } catch {
    return null;
  }
}

function limpiarAlmacenamiento(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRATION_KEY);
  localStorage.removeItem(SESION_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

/** Destino seguro tras el login: solo rutas internas de la app (nunca otro origen). */
export function rutaInterna(url: string | null | undefined): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : null;
}

/**
 * Sesión del front desk: token de audiencia "web" (Authentication/login) + identidad obtenida de
 * GET /authentication/sesion. Ambos viven en localStorage (sobreviven a cerrar la pestaña); la
 * identidad se vuelve a pedir al arrancar (restaurarSesion, en app.config), pero mientras tanto,
 * o si la API no responde, se usa la última guardada.
 *
 * Los permisos aquí solo deciden qué se muestra: la API los vuelve a exigir en sus endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenSignal = signal<string | null>(leerTokenVigente());
  readonly token = this.tokenSignal.asReadonly();

  /** Vencimiento del token (ms epoch) según el login; null si no se conoce. */
  private readonly expiracionSignal = signal<number | null>(this.tokenSignal() ? leerExpiracion() : null);
  readonly expiracion = this.expiracionSignal.asReadonly();

  /** Usuario del login, para renovar la sesión pidiendo solo la contraseña. */
  readonly usuario = signal<string | null>(this.tokenSignal() ? localStorage.getItem(USUARIO_KEY) : null);

  private readonly sesionSignal = signal<SesionViewModel | null>(
    this.tokenSignal() ? leerSesionGuardada() : null,
  );
  readonly sesion = this.sesionSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly permisos = computed(() => this.sesionSignal()?.permisos ?? []);

  hasPermission(permiso: string): boolean {
    return this.permisos().includes(permiso);
  }

  login(request: LoginRequest): Observable<AuthenticatedResponse> {
    return this.http
      .post<AuthenticatedResponse>(`${environment.apiUrl}/authentication/login`, request)
      .pipe(
        tap((response) => {
          // Otro usuario pudo haber dejado su identidad guardada en este navegador
          localStorage.removeItem(SESION_KEY);
          this.sesionSignal.set(null);
          this.guardarToken(response, request.username);
        }),
      );
  }

  /**
   * Renueva el token antes de que venza sin salir de la página (lo abierto no se pierde). Debe
   * ser el mismo usuario: si no, se cierra la sesión para no mezclar el trabajo de otro.
   */
  renovar(password: string, username = this.usuario() ?? ''): Observable<SesionViewModel> {
    const anterior = this.sesionSignal()?.userId ?? null;
    return this.http
      .post<AuthenticatedResponse>(`${environment.apiUrl}/authentication/login`, { username, password })
      .pipe(
        switchMap((response) => {
          this.guardarToken(response, username);
          return this.cargarSesion();
        }),
        tap((sesion) => {
          if (anterior !== null && sesion.userId !== anterior) {
            this.logout();
            throw new ApiError(403, 'Ese usuario no es el de esta sesión. Inicie sesión de nuevo.');
          }
        }),
      );
  }

  private guardarToken(response: AuthenticatedResponse, username: string): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(TOKEN_EXPIRATION_KEY, response.expiration);
    localStorage.setItem(USUARIO_KEY, username);
    this.tokenSignal.set(response.token);
    this.expiracionSignal.set(leerExpiracion());
    this.usuario.set(username);
  }

  /** Hidrata sesion() desde el token ya guardado. Si el token venció o es inválido, el 401 limpia la sesión (ver error.interceptor). */
  cargarSesion(): Observable<SesionViewModel> {
    return this.http.get<SesionViewModel>(`${environment.apiUrl}/authentication/sesion`).pipe(
      tap((sesion) => {
        localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
        this.sesionSignal.set(sesion);
      }),
    );
  }

  /**
   * Al arrancar la app con un token guardado: refresca nombre y permisos. Un token vencido o
   * revocado termina en logout (error.interceptor); un fallo de red no bloquea el arranque y se
   * sigue con la sesión guardada.
   */
  async restaurarSesion(): Promise<void> {
    if (!this.tokenSignal()) return;
    try {
      await firstValueFrom(this.cargarSesion());
    } catch {
      // El error ya lo manejó el interceptor (401 → logout); con otros, queda la sesión guardada
    }
  }

  /**
   * Cierra la sesión. Con `vencida` (token vencido o revocado) el login lo explica y, al volver a
   * entrar, regresa a la página en que estaba.
   */
  logout(opciones: { vencida?: boolean } = {}): void {
    if (!this.tokenSignal()) return;
    const volver = opciones.vencida ? rutaInterna(this.router.url) : null;
    limpiarAlmacenamiento();
    this.tokenSignal.set(null);
    this.expiracionSignal.set(null);
    this.sesionSignal.set(null);
    this.usuario.set(null);
    this.router.navigate(['/login'], {
      queryParams: opciones.vencida ? { vencida: 1, ...(volver && volver !== '/' ? { volver } : {}) } : {},
    });
  }
}
