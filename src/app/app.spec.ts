import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { App } from './app';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ApiError } from './core/models/api-error';
import { itemsVisibles } from './core/navigation/navigation';
import { Permisos } from './core/permissions/permisos';
import { AuthService } from './core/services/auth.service';

const sesionGuardada = (permisos: string[]) =>
  JSON.stringify({ tipoSesion: 'web', nombre: 'Ana Pérez', userId: 1, permisos });

describe('App', () => {
  it('monta el router', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });
});

describe('itemsVisibles', () => {
  it('sin permisos solo deja Inicio', () => {
    expect(itemsVisibles([]).map((i) => i.path)).toEqual(['/']);
  });

  it('muestra cada módulo según su permiso', () => {
    expect(itemsVisibles([Permisos.Eventos, Permisos.Usuarios]).map((i) => i.path)).toEqual(['/', '/eventos', '/usuarios']);
  });

  it('el mapa de unidades usa el permiso de Unidades', () => {
    expect(itemsVisibles([Permisos.UnidadesDenominacion]).map((i) => i.path)).toEqual([
      '/',
      '/unidades-denominacion',
      '/unidades-mapa',
    ]);
  });
});

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });

  it('descarta un token guardado que ya venció', () => {
    localStorage.setItem('sigav.token', 'viejo');
    localStorage.setItem('sigav.tokenExpiration', new Date(Date.now() - 60_000).toISOString());
    localStorage.setItem('sigav.sesion', sesionGuardada([Permisos.Eventos]));

    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.sesion()).toBeNull();
    expect(localStorage.getItem('sigav.token')).toBeNull();
  });

  it('arranca con la sesión guardada mientras el token siga vigente (aunque la API no responda)', () => {
    localStorage.setItem('sigav.token', 'vigente');
    localStorage.setItem('sigav.tokenExpiration', new Date(Date.now() + 3_600_000).toISOString());
    localStorage.setItem('sigav.sesion', sesionGuardada([Permisos.Agentes]));

    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.hasPermission(Permisos.Agentes)).toBe(true);
    expect(auth.hasPermission(Permisos.Usuarios)).toBe(false);
  });
});

describe('interceptores', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sigav.token', 'tk');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('envía el token solo a la API', () => {
    http.get(`${environment.apiUrl}/eventos`).subscribe();
    http.get('https://otro-sitio.example/recurso').subscribe();

    expect(backend.expectOne(`${environment.apiUrl}/eventos`).request.headers.get('Authorization')).toBe('Bearer tk');
    expect(backend.expectOne('https://otro-sitio.example/recurso').request.headers.has('Authorization')).toBe(false);
  });

  it('sin respuesta del servidor da un mensaje en español, no el del navegador', () => {
    let error: unknown;
    http.get(`${environment.apiUrl}/eventos`).subscribe({ error: (e) => (error = e) });
    backend.expectOne(`${environment.apiUrl}/eventos`).error(new ProgressEvent('error'), { status: 0 });

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain('No hay conexión con el servidor');
  });

  it('usa el { message } de la API', () => {
    let error: unknown;
    http.put(`${environment.apiUrl}/usuarios/1/permisos`, {}).subscribe({ error: (e) => (error = e) });
    backend
      .expectOne(`${environment.apiUrl}/usuarios/1/permisos`)
      .flush({ message: 'No puede quitarse a sí mismo el permiso.' }, { status: 409, statusText: 'Conflict' });

    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe('No puede quitarse a sí mismo el permiso.');
  });
});
