import { Injectable, signal } from '@angular/core';

export type TonoAviso = 'exito' | 'error';

export type AccionAviso = { label: string; ejecutar: () => void };

export type Aviso = { id: number; texto: string; tono: TonoAviso; accion?: AccionAviso };

/** Tiempo en pantalla: los errores y los que ofrecen "Deshacer" duran más. */
const DURACION_MS = { exito: 6_000, conAccion: 10_000, error: 12_000 };
/** Más que esto apila demasiado: se descartan los más antiguos. */
const MAXIMO = 4;

/**
 * Avisos flotantes (toasts) de toda la app: confirmación de lo que se acaba de hacer o error de
 * una acción. Se dibujan en app-avisos (en el shell), siempre a la vista aunque la página tenga
 * scroll, y se cierran solos; al pasar el mouse o enfocarlos se detiene la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private siguienteId = 0;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  private readonly lista = signal<readonly Aviso[]>([]);
  readonly avisos = this.lista.asReadonly();

  exito(texto: string, accion?: AccionAviso): number {
    return this.mostrar({ texto, tono: 'exito', accion });
  }

  error(texto: string, accion?: AccionAviso): number {
    return this.mostrar({ texto, tono: 'error', accion });
  }

  cerrar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.delete(id);
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }

  /** Detiene el cierre automático (mouse encima o foco dentro). */
  pausar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.delete(id);
  }

  /** Vuelve a contar el tiempo completo desde ahora. */
  reanudar(id: number): void {
    const aviso = this.lista().find((a) => a.id === id);
    if (aviso) this.programar(aviso);
  }

  private mostrar(datos: Omit<Aviso, 'id'>): number {
    const aviso: Aviso = { ...datos, id: this.siguienteId++ };
    const actuales = this.lista();
    for (const viejo of actuales.slice(0, Math.max(0, actuales.length - MAXIMO + 1))) this.cerrar(viejo.id);
    this.lista.update((l) => [...l, aviso]);
    this.programar(aviso);
    return aviso.id;
  }

  private programar(aviso: Aviso): void {
    clearTimeout(this.temporizadores.get(aviso.id));
    const ms = aviso.tono === 'error' ? DURACION_MS.error : aviso.accion ? DURACION_MS.conAccion : DURACION_MS.exito;
    this.temporizadores.set(
      aviso.id,
      setTimeout(() => this.cerrar(aviso.id), ms),
    );
  }
}
