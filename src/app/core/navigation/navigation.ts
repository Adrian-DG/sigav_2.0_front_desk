import type { IconName } from '../../shared/components/icon/icon';
import { Permisos, type Permiso } from '../permissions/permisos';

export type NavItem = {
  label: string;
  path: string;
  icon: IconName;
  descripcion: string;
  /** Sin permiso: visible para cualquier sesión web. */
  permiso?: Permiso;
};

/** Menú lateral y accesos del inicio. Cada ruta protegida en app.routes.ts usa el mismo permiso. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', path: '/', icon: 'inicio', descripcion: 'Resumen de la operación' },
  {
    label: 'Eventos',
    path: '/eventos',
    icon: 'eventos',
    descripcion: 'Asistencias y accidentes reportados por las unidades',
    permiso: Permisos.Eventos,
  },
  {
    label: 'Mapa de calor',
    path: '/mapa',
    icon: 'mapa',
    descripcion: 'Accidentes y asistencias en el mapa del país',
    permiso: Permisos.Eventos,
  },
  {
    label: 'Agentes',
    path: '/agentes',
    icon: 'agentes',
    descripcion: 'Personal operativo y su autorización',
    permiso: Permisos.Agentes,
  },
  {
    label: 'Unidades',
    path: '/unidades-denominacion',
    icon: 'unidades',
    descripcion: 'Unidades, fichas y denominaciones por tramo',
    permiso: Permisos.UnidadesDenominacion,
  },
  {
    label: 'Mapa de unidades',
    path: '/unidades-mapa',
    icon: 'ubicacion',
    descripcion: 'Dónde están ahora las unidades con sesión en la app',
    permiso: Permisos.UnidadesDenominacion,
  },
  {
    label: 'Usuarios',
    path: '/usuarios',
    icon: 'usuarios',
    descripcion: 'Usuarios del front desk y sus permisos',
    permiso: Permisos.Usuarios,
  },
];

export const itemsVisibles = (permisos: readonly string[]) =>
  NAV_ITEMS.filter((item) => !item.permiso || permisos.includes(item.permiso));
