import { Component, input } from '@angular/core';

/**
 * Un filtro de la barra de filtros: etiqueta arriba y el control proyectado debajo (un select,
 * un input de fecha, app-busqueda...). El label envuelve al control, así que quedan asociados.
 */
@Component({
  selector: 'app-filtro',
  standalone: true,
  template: `
    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-bold tracking-wide text-neutral-500 uppercase">{{ etiqueta() }}</span>
      <ng-content />
    </label>
  `,
  host: { class: 'block' },
})
export class Filtro {
  readonly etiqueta = input.required<string>();
}
