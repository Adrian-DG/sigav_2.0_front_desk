/** POST /notificaciones (unidadIds null: todas las conectadas). */
export type EnviarNotificacionRequest = { titulo: string; mensaje: string; unidadIds: number[] | null };
export type EnviarNotificacionResult = { unidadesConectadas: number };

export const TITULO_MAX = 100;
export const MENSAJE_MAX = 500;
