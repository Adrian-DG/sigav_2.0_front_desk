import { Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

/** Pie de un listado paginado (PagedResult): rango mostrado y botones anterior/siguiente. */
@Component({
  selector: 'app-paginador',
  standalone: true,
  imports: [Icon],
  template: `
    <nav
      aria-label="Paginación"
      class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-sm"
    >
      <p class="font-medium text-neutral-500">
        @if (total() > 0) {
          {{ desde() }}–{{ hasta() }} de {{ total() }}
        } @else {
          Sin resultados
        }
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
          [disabled]="pagina() <= 1"
          (click)="paginaChange.emit(pagina() - 1)"
        >
          <app-icon name="anterior" class="h-4 w-4" />
        </button>
        <span class="min-w-24 text-center font-semibold text-neutral-700">
          Página {{ pagina() }} de {{ paginas() }}
        </span>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
          [disabled]="pagina() >= paginas()"
          (click)="paginaChange.emit(pagina() + 1)"
        >
          <app-icon name="siguiente" class="h-4 w-4" />
        </button>
      </div>
    </nav>
  `,
})
export class Paginador {
  readonly pagina = input.required<number>();
  readonly tamano = input.required<number>();
  readonly total = input.required<number>();
  readonly paginaChange = output<number>();

  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano())));
  protected readonly desde = computed(() => (this.pagina() - 1) * this.tamano() + 1);
  protected readonly hasta = computed(() => Math.min(this.pagina() * this.tamano(), this.total()));
}
