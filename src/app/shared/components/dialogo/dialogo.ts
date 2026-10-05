import { Component, Directive, ElementRef, contentChild, effect, input, output, viewChild } from '@angular/core';

import { Icon } from '../icon/icon';

/** Marca los botones del pie del diálogo. */
@Directive({ selector: '[dialogoAcciones]' })
export class DialogoAcciones {}

/**
 * Diálogo modal sobre el <dialog> nativo (foco atrapado, Esc para cerrar, fondo inerte). Se abre
 * y cierra con `abierto`; cualquier cierre (Esc, ✕, fondo) emite `cerrar` para que el padre
 * actualice su estado. El cuerpo llega por content projection y el pie con [dialogoAcciones].
 */
@Component({
  selector: 'app-dialogo',
  standalone: true,
  imports: [Icon],
  template: `
    <dialog
      #nativo
      class="m-auto rounded-2xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-neutral-900/50"
      [class]="ancho() === 'amplio' ? 'w-[min(48rem,calc(100vw-2rem))]' : 'w-[min(36rem,calc(100vw-2rem))]'"
      [attr.aria-labelledby]="idTitulo"
      (close)="cerrar.emit()"
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
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          (click)="nativo.close()"
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
    </dialog>
  `,
})
export class Dialogo {
  private static siguienteId = 0;
  protected readonly idTitulo = `dialogo-titulo-${Dialogo.siguienteId++}`;

  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  /** amplio: formularios de dos columnas. */
  readonly ancho = input<'normal' | 'amplio'>('normal');
  readonly cerrar = output();

  protected readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('nativo');
  protected readonly acciones = contentChild(DialogoAcciones);

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.abierto() && !dialogo.open) dialogo.showModal();
      else if (!this.abierto() && dialogo.open) dialogo.close();
    });
  }

  /** Un clic directo sobre <dialog> (no sobre su contenido) es un clic en el fondo. */
  protected cerrarSiEsFondo(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.dialogo().nativeElement.close();
  }
}
