/** Domain/Enums RegionMacroEnum: región a la que pertenece cada zona. */
export const REGIONES: readonly { valor: number; label: string }[] = [
  { valor: 1, label: 'Este' },
  { valor: 2, label: 'Norte' },
  { valor: 3, label: 'Sur' },
];

/** GET /zonas (Application/Features/Operaciones/Zonas/ZonaViewModels.cs ZonaViewModel). */
export type Zona = {
  id: number;
  nombre: string;
  region: number;
  isActive: boolean;
  tramos: TramoDeZona[];
};

/** denominaciones: denominaciones activas que tienen este tramo como propio. */
export type TramoDeZona = { id: number; nombre: string; isActive: boolean; denominaciones: number };

/** Qué se está creando: una zona, o un tramo (con la zona ya elegida si se abrió desde ella). */
export type Creacion = { tipo: 'zona' } | { tipo: 'tramo'; zonaId: number | null };

/** Largo máximo del nombre (Zona.NombreMaxLength y Tramo.NombreMaxLength). */
export const NOMBRE_MAX = 100;
