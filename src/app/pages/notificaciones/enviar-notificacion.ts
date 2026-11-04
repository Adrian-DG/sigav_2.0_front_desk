import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

import { environment } from '../../../environments/environment';
import { huella } from '../../core/utils/huella';
import { mensajeDeError } from '../../core/utils/formato';
import { Button } from '../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../shared/components/dialogo/dialogo';
import type { UnidadDisponibilidad } from '../eventos/asignacion.model';
import {
  MENSAJE_MAX,
  TITULO_MAX,
  type EnviarNotificacionRequest,
  type EnviarNotificacionResult,
} from './notificaciones.model';

/** Lo que se preselecciona al abrir: sin unidades, a todas. */
export type InicioNotificacion = { unidadIds?: number[] };

type Destino = 'todas' | 'seleccion';

/**
 * Mensaje del call center a las unidades (POST /notificaciones): a todas las que tengan
 * la app conectada o solo a las elegidas. Llega al momento por SignalR; la que no esté conectada
 * no lo recibe (no queda guardado).
 */
@Component({
  selector: 'app-enviar-notificacion',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button],
  template: `
    <app-dialogo
      [abierto]="!!inicio()"
      titulo="Enviar notificación"
      descripcion="Llega al momento a las unidades que tengan la app conectada."
      [sucio]="sucio()"
      [ocupado]="enviando()"
      (cerrar)="cerrar.emit()"
    >
      <form class="flex flex-col gap-5" novalidate (submit)="$event.preventDefault(); enviar()">
        <fieldset class="flex flex-col gap-2" [disabled]="enviando()">
          <legend class="mb-2 text-sm font-semibold text-neutral-600">Destinatarios</legend>
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
            <input type="radio" name="destino" class="h-4 w-4 accent-primary-600" [checked]="destino() === 'todas'" (change)="destino.set('todas')" />
            Todas las unidades conectadas <span class="text-neutral-400">({{ conectadas().length }})</span>
          </label>
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
            <input type="radio" name="destino" class="h-4 w-4 accent-primary-600" [checked]="destino() === 'seleccion'" (change)="destino.set('seleccion')" />
            Unidades específicas
          </label>
          @if (destino() === 'seleccion') {
            <div class="ml-6 flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-xl border border-neutral-100 p-3">
              @for (u of unidades(); track u.unidadId) {
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-primary-600"
                    [checked]="seleccion().has(u.unidadId)"
                    (change)="alternar(u.unidadId, $any($event.target).checked)"
                  />
                  <span class="font-semibold">{{ u.ficha }}</span>
                  <span class="text-neutral-500">{{ u.denominacion ?? 'Sin denominación' }}</span>
                  @if (!u.conectadaNotificaciones) {
                    <span class="text-xs text-warning-800">· sin conexión</span>
                  }
                </label>
              } @empty {
                <p class="text-sm text-neutral-500">{{ cargandoUnidades() ? 'Cargando unidades…' : 'No hay unidades con sesión abierta.' }}</p>
              }
            </div>
            @if (intentado() && errores()['unidades']; as e) {
              <span class="ml-6 text-xs font-medium text-danger-600">{{ e }}</span>
            }
          }
        </fieldset>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-neutral-600">Título</span>
          <input
            class="control"
            autocomplete="off"
            placeholder="Aviso del centro de operaciones"
            [attr.maxlength]="tituloMax"
            [disabled]="enviando()"
            [value]="titulo()"
            (input)="titulo.set($any($event.target).value)"
          />
          @if (intentado() && errores()['titulo']; as e) {
            <span class="text-xs font-medium text-danger-600">{{ e }}</span>
          }
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-neutral-600">Mensaje</span>
          <textarea
            class="control min-h-24 py-2"
            [attr.maxlength]="mensajeMax"
            [disabled]="enviando()"
            [value]="mensaje()"
            (input)="mensaje.set($any($event.target).value)"
          ></textarea>
          <span class="self-end text-xs text-neutral-400">{{ mensaje().length }}/{{ mensajeMax }}</span>
          @if (intentado() && errores()['mensaje']; as e) {
            <span class="text-xs font-medium text-danger-600">{{ e }}</span>
          }
        </label>

        @if (errorGeneral()) {
          <p class="rounded-xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700" role="alert">{{ errorGeneral() }}</p>
        }
      </form>

      <app-button dialogoAcciones variant="ghost" [bloque]="false" [disabled]="enviando()" (click)="cancelar()">Cancelar</app-button>
      <app-button dialogoAcciones [bloque]="false" [loading]="enviando()" (click)="enviar()">Enviar</app-button>
    </app-dialogo>
  `,
})
export class EnviarNotificacion {
  private readonly http = inject(HttpClient);

  /** null: cerrado. */
  readonly inicio = input<InicioNotificacion | null>(null);
  /** Unidades con sesión (las carga la página). */
  readonly unidades = input<UnidadDisponibilidad[]>([]);
  readonly cargandoUnidades = input(false);
  readonly cerrar = output();

  private readonly dialogo = viewChild.required(Dialogo);
  /** Contenido del formulario al abrirlo: si cambia, cerrar pide confirmación. */
  private readonly huellaInicial = signal('');
  protected readonly sucio = computed(() => huella([this.destino(), this.seleccion(), this.titulo(), this.mensaje()]) !== this.huellaInicial());
  readonly enviada = output<EnviarNotificacionResult>();

  protected readonly tituloMax = TITULO_MAX;
  protected readonly mensajeMax = MENSAJE_MAX;

  protected readonly destino = signal<Destino>('todas');
  protected readonly seleccion = signal<ReadonlySet<number>>(new Set());
  protected readonly titulo = signal('');
  protected readonly mensaje = signal('');
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly conectadas = computed(() => this.unidades().filter((u) => u.conectadaNotificaciones));

  protected readonly errores = computed(() => {
    const e: Record<string, string> = {};
    if (!this.titulo().trim()) e['titulo'] = 'El título es requerido.';
    if (!this.mensaje().trim()) e['mensaje'] = 'El mensaje es requerido.';
    if (this.destino() === 'seleccion' && this.seleccion().size === 0) e['unidades'] = 'Seleccione al menos una unidad.';
    return e;
  });

  constructor() {
    effect(() => {
      const inicio = this.inicio();
      if (!inicio) return;
      untracked(() => {
        const ids = inicio.unidadIds ?? [];
        this.destino.set(ids.length ? 'seleccion' : 'todas');
        this.seleccion.set(new Set(ids));
        this.titulo.set('');
        this.mensaje.set('');
        this.huellaInicial.set(huella([this.destino(), this.seleccion(), this.titulo(), this.mensaje()]));
        this.intentado.set(false);
        this.errorGeneral.set(null);
      });
    });
  }

  protected alternar(unidadId: number, marcada: boolean): void {
    this.seleccion.update((s) => {
      const nueva = new Set(s);
      if (marcada) nueva.add(unidadId);
      else nueva.delete(unidadId);
      return nueva;
    });
  }

  protected cancelar(): void {
    this.dialogo().solicitarCierre();
  }

  protected enviar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.enviando()) return;

    const body: EnviarNotificacionRequest = {
      titulo: this.titulo().trim(),
      mensaje: this.mensaje().trim(),
      unidadIds: this.destino() === 'todas' ? null : [...this.seleccion()],
    };
    this.enviando.set(true);
    this.errorGeneral.set(null);
    this.http.post<EnviarNotificacionResult>(`${environment.apiUrl}/notificaciones`, body).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.enviada.emit(resultado);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errorGeneral.set(mensajeDeError(error) ?? 'No se pudo enviar la notificación.');
      },
    });
  }
}
