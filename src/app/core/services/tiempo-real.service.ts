import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Subject, filter, merge } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Copia de Backend/Application/Contracts/Notificaciones/IMonitorTiempoReal.cs (TiposCambioTiempoReal). */
export type TipoCambio = 'eventos' | 'unidades';

/** Lo que envía el hub de monitoreo: qué cambió, no los datos (cada pantalla vuelve a pedir lo suyo). */
export interface CambioTiempoReal {
  tipo: TipoCambio;
  ids: number[];
  fechaUtc: string;
}

export type EstadoTiempoReal = 'conectado' | 'conectando' | 'desconectado';

/** El hub vive en la raíz de la API, no bajo /api. */
const URL_HUB = `${environment.apiUrl.replace(/\/api\/?$/, '')}/hubs/monitoreo`;
const METODO_CAMBIO = 'cambio';
/** Si se agotan los reintentos automáticos, se vuelve a intentar cada tanto mientras haya sesión. */
const REINTENTO_MS = 30_000;

/**
 * Conexión del front desk al hub de monitoreo (SignalR): avisa cuando cambian eventos o unidades
 * para que las pantallas abiertas se recarguen al momento. Se conecta sola mientras hay sesión y
 * se cierra al salir. Las pantallas no usan el servicio directamente sino {@link alCambiar}.
 */
@Injectable({ providedIn: 'root' })
export class TiempoRealService {
  private readonly auth = inject(AuthService);

  private readonly estadoSignal = signal<EstadoTiempoReal>('desconectado');
  readonly estado = this.estadoSignal.asReadonly();

  private readonly cambiosSubject = new Subject<CambioTiempoReal>();
  readonly cambios$ = this.cambiosSubject.asObservable();
  /** Se volvió a conectar tras un corte: pudieron perderse cambios, conviene recargar. */
  private readonly reconectadoSubject = new Subject<void>();
  readonly reconectado$ = this.reconectadoSubject.asObservable();

  private conexion: HubConnection | null = null;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private huboConexion = false;

  constructor() {
    effect(() => {
      if (this.auth.token()) void this.conectar();
      else void this.desconectar();
    });
  }

  private async conectar(): Promise<void> {
    if (this.conexion) return;

    const conexion = new HubConnectionBuilder()
      .withUrl(URL_HUB, {
        // Se lee en cada (re)conexión: toma el token renovado sin reiniciar nada
        accessTokenFactory: () => this.auth.token() ?? '',
        // La política CORS de la API no permite credenciales (cookies): el token va en el query string
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(environment.production ? LogLevel.None : LogLevel.Warning)
      .build();

    conexion.on(METODO_CAMBIO, (cambio: CambioTiempoReal) => this.cambiosSubject.next(cambio));
    conexion.onreconnecting(() => this.estadoSignal.set('conectando'));
    conexion.onreconnected(() => {
      this.estadoSignal.set('conectado');
      this.reconectadoSubject.next();
    });
    conexion.onclose(() => {
      this.estadoSignal.set('desconectado');
      if (this.conexion === conexion) this.programarReintento();
    });

    this.conexion = conexion;
    await this.iniciar(conexion);
  }

  private async iniciar(conexion: HubConnection): Promise<void> {
    if (this.conexion !== conexion || conexion.state !== HubConnectionState.Disconnected) return;

    this.estadoSignal.set('conectando');
    try {
      await conexion.start();
      this.estadoSignal.set('conectado');
      if (this.huboConexion) this.reconectadoSubject.next();
      this.huboConexion = true;
    } catch {
      this.estadoSignal.set('desconectado');
      this.programarReintento();
    }
  }

  private programarReintento(): void {
    if (this.reintento || !this.auth.token()) return;
    this.reintento = setTimeout(() => {
      this.reintento = null;
      if (this.conexion) void this.iniciar(this.conexion);
    }, REINTENTO_MS);
  }

  private async desconectar(): Promise<void> {
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = null;
    this.huboConexion = false;

    const conexion = this.conexion;
    this.conexion = null;
    this.estadoSignal.set('desconectado');
    await conexion?.stop().catch(() => undefined);
  }
}

export interface OpcionesAlCambiar {
  /** Solo reaccionar si el cambio incluye este id (p. ej. el evento abierto). null: no reaccionar. */
  id?: () => number | null;
  /** Espera mínima entre dos recargas: las ráfagas (GPS de muchas unidades) se agrupan en una. */
  esperaMs?: number;
}

/**
 * Ejecuta `recargar` cuando llegan cambios del tipo indicado (o al reconectarse el hub), agrupando
 * las ráfagas y esperando a que la pestaña esté visible. Llamar en un contexto de inyección
 * (constructor); se limpia sola al destruirse el componente.
 */
export function alCambiar(tipo: TipoCambio, recargar: () => void, opciones: OpcionesAlCambiar = {}): void {
  const tiempoReal = inject(TiempoRealService);
  const esperaMs = opciones.esperaMs ?? 2_000;

  let ultima = 0;
  let programada: ReturnType<typeof setTimeout> | null = null;
  let pendienteOculta = false;

  const ejecutar = () => {
    programada = null;
    if (document.visibilityState !== 'visible') {
      pendienteOculta = true;
      return;
    }
    ultima = Date.now();
    recargar();
  };

  const solicitar = () => {
    if (programada) return;
    programada = setTimeout(ejecutar, Math.max(0, ultima + esperaMs - Date.now()));
  };

  const alVolver = () => {
    if (pendienteOculta && document.visibilityState === 'visible') {
      pendienteOculta = false;
      solicitar();
    }
  };
  document.addEventListener('visibilitychange', alVolver);

  const suscripcion = merge(
    tiempoReal.cambios$.pipe(
      filter((c) => c.tipo === tipo),
      filter((c) => {
        if (!opciones.id) return true;
        const id = opciones.id();
        return id !== null && c.ids.includes(id);
      }),
    ),
    tiempoReal.reconectado$,
  ).subscribe(solicitar);

  inject(DestroyRef).onDestroy(() => {
    suscripcion.unsubscribe();
    document.removeEventListener('visibilitychange', alVolver);
    if (programada) clearTimeout(programada);
  });
}
