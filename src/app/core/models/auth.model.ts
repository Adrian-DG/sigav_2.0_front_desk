/** Mirrors Application/Features/Authentication/LoginUser.cs LoginUserCommand. */
export type LoginRequest = {
  username: string;
  password: string;
};

/** Mirrors Application/Features/Authentication/LoginUser.cs AuthenticatedResponse. */
export type AuthenticatedResponse = {
  token: string;
  expiration: string;
};

/**
 * Mirrors Application/Features/Authentication/GetSesionActual.cs SesionViewModel.
 * El front desk solo emite tokens de audiencia "web" (AuthenticationController.Login), así que
 * tipoSesion siempre es 'web' aquí; agenteId/unidadId/ficha son exclusivos de la sesión móvil
 * (LoginMovil) y no aplican a esta app, por eso no se tipan.
 */
export type SesionViewModel = {
  tipoSesion: 'web';
  nombre: string | null;
  userId: number | null;
  permisos: string[];
};
