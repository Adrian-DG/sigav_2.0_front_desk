/** Mirrors Application/Features/Usuarios/Usuarios.cs UsuarioViewModel. */
export type Usuario = {
  id: number;
  userName: string;
  nombreCompleto: string;
  identificacion: string;
  institucion: number;
  rango: string;
  departamento: string;
  bloqueado: boolean;
  permisos: string[];
};

/** Mirrors Application/Contracts/Authentication/Permisos.cs PermisoInfo (GET /usuarios/permisos). */
export type PermisoInfo = {
  nombre: string;
  modulo: string;
  descripcion: string;
};

/** Mirrors Application/Features/Usuarios/CrearUsuario.cs CatalogosUsuarioViewModel (GET /usuarios/catalogos). */
export type CatalogosUsuario = {
  rangos: { id: number; nombre: string; nombreArmada: string }[];
  departamentos: { id: number; nombre: string }[];
};
