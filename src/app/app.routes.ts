import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { Permisos } from './core/permissions/permisos';

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
        loadComponent: enConstruccion,
        canActivate: [permissionGuard(Permisos.Eventos)],
        data: { titulo: 'Eventos' },
      },
      {
        path: 'agentes',
        title: 'Agentes · SiGAV',
        loadComponent: enConstruccion,
        canActivate: [permissionGuard(Permisos.Agentes)],
        data: { titulo: 'Agentes' },
      },
      {
        path: 'unidades-denominacion',
        title: 'Unidades · SiGAV',
        loadComponent: enConstruccion,
        canActivate: [permissionGuard(Permisos.UnidadesDenominacion)],
        data: { titulo: 'Unidades y denominaciones' },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
