import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { Permisos } from './core/permissions/permisos';

// Página temporal para los módulos nuevos que aún no tengan UI: loadComponent: enConstruccion + data: { titulo }
const enConstruccion = () =>
  import('./pages/en-construccion/en-construccion').then((m) => m.EnConstruccion);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · SiGAV',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    // Todo lo que requiere sesión va dentro del shell (menú lateral siempre visible)
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Inicio · SiGAV',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'eventos',
        title: 'Eventos · SiGAV',
        loadComponent: () => import('./pages/eventos/eventos').then((m) => m.Eventos),
        canActivate: [permissionGuard(Permisos.Eventos)],
      },
      {
        path: 'mapa',
        title: 'Mapa de calor · SiGAV',
        loadComponent: () => import('./pages/mapa/mapa').then((m) => m.Mapa),
        canActivate: [permissionGuard(Permisos.Eventos)],
      },
      {
        path: 'agentes',
        title: 'Agentes · SiGAV',
        loadComponent: () => import('./pages/agentes/agentes').then((m) => m.Agentes),
        canActivate: [permissionGuard(Permisos.Agentes)],
      },
      {
        path: 'unidades-denominacion',
        title: 'Unidades · SiGAV',
        loadComponent: () =>
          import('./pages/unidades-denominacion/unidades-denominacion').then((m) => m.UnidadesDenominacion),
        canActivate: [permissionGuard(Permisos.UnidadesDenominacion)],
      },
      {
        path: 'unidades-mapa',
        title: 'Mapa de unidades · SiGAV',
        loadComponent: () => import('./pages/unidades-mapa/unidades-mapa').then((m) => m.UnidadesMapa),
        canActivate: [permissionGuard(Permisos.UnidadesDenominacion)],
      },
      {
        path: 'usuarios',
        title: 'Usuarios · SiGAV',
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
        canActivate: [permissionGuard(Permisos.Usuarios)],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
