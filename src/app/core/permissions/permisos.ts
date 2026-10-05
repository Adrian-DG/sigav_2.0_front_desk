/**
 * Permisos del front desk: llegan en SesionViewModel.permisos (claims "permission" del JWT web,
 * que son los roles de Identity / AppPermission del usuario). Copia de
 * Backend/Application/Contracts/Authentication/Permisos.cs, donde se crean y se describen (el
 * módulo Usuarios los lee de GET /usuarios/permisos); único lugar del front donde se escriben.
 */
export const Permisos = {
  Eventos: 'eventos.ver',
  Agentes: 'agentes.ver',
  UnidadesDenominacion: 'unidades.ver',
  Usuarios: 'usuarios.gestionar',
} as const;

export type Permiso = (typeof Permisos)[keyof typeof Permisos];
