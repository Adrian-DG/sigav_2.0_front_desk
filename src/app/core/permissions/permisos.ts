/**
 * Permisos del front desk: llegan en SesionViewModel.permisos (claims "permission" del JWT web,
 * que son los roles de Identity / AppPermission del usuario). Los nombres deben coincidir con los
 * roles que se registren en el backend; único lugar del front donde se escriben.
 */
export const Permisos = {
  Eventos: 'eventos.ver',
  Agentes: 'agentes.ver',
  UnidadesDenominacion: 'unidades.ver',
} as const;

export type Permiso = (typeof Permisos)[keyof typeof Permisos];
