import {
  Component,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Icon } from '../icon/icon';

/** Marca los botones del pie del diálogo. */
@Directive({ selector: '[dialogoAcciones]' })
export class DialogoAcciones {}

/**
 * Diálogo modal sobre el <dialog> nativo (foco atrapado, Esc para cerrar, fondo inerte). Se abre
 * y cierra con `abierto`; cualquier cierre (Esc, ✕, fondo o `solicitarCierre()`) emite `cerrar`
 * para que el padre actualice su estado. El cuerpo llega por content projection y el pie con
 * [dialogoAcciones].
 *
 * Formularios: con `ocupado` (guardando) no se cierra; con `sucio` (hay cambios sin guardar)
 * pide confirmar antes de descartarlos. El botón "Cancelar" del padre debe llamar a
 * `solicitarCierre()` para pasar por la misma confirmación.
 */
@Component({
  selector: 'app-dialogo',
  standalone: true,
  imports: [Icon],
  template: `
    <dialog
      #nativo
      class="m-auto overflow-hidden rounded-2xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-neutral-900/50"
      [class]="ancho() === 'amplio' ? 'w-[min(48rem,calc(100vw-2rem))]' : 'w-[min(36rem,calc(100vw-2rem))]'"
      [attr.aria-labelledby]="idTitulo"
      (cancel)="alCancelar($event)"
      (close)="alCerrarNativo()"
      (click)="cerrarSiEsFondo($event)"
    >
      <div class="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
        <div class="min-w-0">
          <h2 [id]="idTitulo" class="text-lg font-extrabold">{{ titulo() }}</h2>
          @if (descripcion()) {
            <p class="mt-0.5 text-sm text-neutral-500">{{ descripcion() }}</p>
          }
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="ocupado()"
          (click)="solicitarCierre()"
        >
          <app-icon name="limpiar" class="h-5 w-5" />
        </button>
      </div>

      <div class="max-h-[65vh] overflow-y-auto px-6 py-5">
        <ng-content />
      </div>

      @if (acciones()) {
        <div class="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-6 py-4">
          <ng-content select="[dialogoAcciones]" />
        </div>
      }

      @if (confirmandoDescarte()) {
        <!-- Confirmación sobre el contenido: el formulario sigue debajo, intacto -->
        <div
          class="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 p-6 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="idTitulo + '-descarte'"
          [attr.aria-describedby]="idTitulo + '-descarte-texto'"
        >
          <div class="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-xl">
            <p [id]="idTitulo + '-descarte'" class="text-base font-extrabold text-neutral-900">¿Descartar los cambios?</p>
            <p [id]="idTitulo + '-descarte-texto'" class="mt-1 text-sm text-neutral-500">
              Lo que escribió en este formulario se perderá.
            </p>
            <div class="mt-5 flex flex-wrap justify-center gap-2">
              <button
                #seguir
                type="button"
                class="min-h-11 rounded-xl px-4 text-base font-bold text-primary-600 transition-colors hover:bg-primary-50"
                (click)="seguirEditando()"
              >
                Seguir editando
              </button>
              <button
                type="button"
                class="min-h-11 rounded-xl bg-danger-600 px-4 text-base font-bold text-white transition-colors hover:bg-danger-700"
                (click)="descartar()"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class Dialogo {
  private static siguienteId = 0;
  protected readonly idTitulo = `dialogo-titulo-${Dialogo.siguienteId++}`;
  private readonly injector = inject(Injector);

  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  /** amplio: formularios de dos columnas. */
  readonly ancho = input<'normal' | 'amplio'>('normal');
  /** Hay cambios sin guardar: cerrar pide confirmación. */
  readonly sucio = input(false);
  /** Guardando o enviando: no se puede cerrar. */
  readonly ocupado = input(false);
  readonly cerrar = output();

  protected readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('nativo');
  protected readonly acciones = contentChild(DialogoAcciones);
  private readonly botonSeguir = viewChild<ElementRef<HTMLButtonElement>>('seguir');

  protected readonly confirmandoDescarte = signal(false);
  /** Ya se confirmó el descarte: el próximo cierre pasa sin preguntar. */
  private descarteConfirmado = false;
  /** El cierre lo hizo este componente (ya emitió `cerrar` o lo pidió el padre): el evento close se ignora. */
  private cerradoPorCodigo = false;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.abierto() && !dialogo.open) {
        this.descarteConfirmado = false;
        this.cerradoPorCodigo = false;
        this.confirmandoDescarte.set(false);
        dialogo.showModal();
      } else if (!this.abierto() && dialogo.open) {
        this.cerradoPorCodigo = true;
        dialogo.close();
      }
    });
  }

  /** Cierra como el ✕: respeta `ocupado` y `sucio`. Para el botón "Cancelar" del padre. */
  solicitarCierre(): void {
    if (!this.dialogo().nativeElement.open || this.ocupado()) return;
    if (this.sucio() && !this.descarteConfirmado) this.mostrarConfirmacion();
    else this.cerrarYa();
  }

  /** Esc: en vez del cierre nativo, el mismo camino que el ✕. */
  protected alCancelar(evento: Event): void {
    evento.preventDefault();
    if (this.confirmandoDescarte()) this.seguirEditando();
    else this.solicitarCierre();
  }

  /**
   * Cierre nativo que no pasó por solicitarCierre (el navegador no deja cancelar un Esc repetido,
   * CloseWatcher): si el padre lo quiere abierto y no se debe cerrar, se vuelve a mostrar.
   */
  protected alCerrarNativo(): void {
    const dialogo = this.dialogo().nativeElement;
    if (this.cerradoPorCodigo || dialogo.open) {
      this.cerradoPorCodigo = false;
      return;
    }
    if (this.abierto() && (this.ocupado() || (this.sucio() && !this.descarteConfirmado))) {
      dialogo.showModal();
      if (!this.ocupado()) this.mostrarConfirmacion();
      return;
    }
    this.confirmandoDescarte.set(false);
    this.cerrar.emit();
  }

  protected seguirEditando(): void {
    this.confirmandoDescarte.set(false);
  }

  protected descartar(): void {
    this.descarteConfirmado = true;
    this.cerrarYa();
  }

  private mostrarConfirmacion(): void {
    this.confirmandoDescarte.set(true);
    afterNextRender(() => this.botonSeguir()?.nativeElement.focus(), { injector: this.injector });
  }

  private cerrarYa(): void {
    this.confirmandoDescarte.set(false);
    this.cerradoPorCodigo = true;
    this.dialogo().nativeElement.close();
    this.cerrar.emit();
  }

  /** Un clic directo sobre <dialog> (no sobre su contenido) es un clic en el fondo. */
  protected cerrarSiEsFondo(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.solicitarCierre();
  }
}
