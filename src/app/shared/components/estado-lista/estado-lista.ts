import { Component, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Cuerpo de un listado según el estado de la carga: indicador mientras llega la primera página,
 * error con "Reintentar", mensaje si no hay resultados o, si hay datos, el contenido proyectado.
 * Al recargar con datos ya visibles, estos se mantienen atenuados en vez de vaciar la tabla.
 */
@Component({
  selector: 'app-estado-lista',
  standalone: true,
  imports: [Icon],
  template: `
    @if (error(); as mensaje) {
      <div class="flex flex-col items-center px-6 py-14 text-center" role="alert">
        <p class="text-base font-bold text-danger-700">No se pudo cargar el listado</p>
        <p class="mt-1 max-w-md text-sm text-neutral-500">{{ mensaje }}</p>
        <button
          type="button"
          class="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50"
          (click)="reintentar.emit()"
        >
          <app-icon name="actualizar" class="h-4 w-4" /> Reintentar
        </button>
      </div>
    } @else if (cargando() && !hayDatos()) {
      <div class="flex justify-center py-16" aria-live="polite">
        <svg class="h-7 w-7 animate-spin text-primary-500" viewBox="0 0 24 24" fill="none" aria-label="Cargando">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      </div>
    } @else if (!hayDatos()) {
      <div class="flex flex-col items-center px-6 py-14 text-center">
        <p class="text-base font-bold text-neutral-800">{{ tituloVacio() }}</p>
        @if (textoVacio()) {
          <p class="mt-1 max-w-md text-sm text-neutral-500">{{ textoVacio() }}</p>
        }
      </div>
    } @else {
      <div class="transition-opacity" [class.opacity-50]="cargando()" [attr.aria-busy]="cargando()">
        <ng-content />
      </div>
    }
  `,
})
export class EstadoLista {
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly hayDatos = input(false);
  readonly tituloVacio = input('Sin resultados');
  readonly textoVacio = input<string>();
  readonly reintentar = output();
}
