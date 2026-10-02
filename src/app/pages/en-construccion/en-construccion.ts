import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../shared/components/icon/icon';

/**
 * Página temporal de los módulos sin UI todavía. El título llega de data.titulo de la ruta
 * (withComponentInputBinding); al implementar un módulo, su ruta pasa a cargar su propia página.
 */
@Component({
  selector: 'app-en-construccion',
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    <div class="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <h1 class="text-2xl font-extrabold text-neutral-900">{{ titulo() }}</h1>
      <div
        class="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center"
      >
        <p class="text-base font-bold text-neutral-800">Módulo en construcción</p>
        <p class="mt-1 max-w-sm text-sm text-neutral-500">
          Esta sección todavía no está disponible en el front desk.
        </p>
        <a
          routerLink="/"
          class="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
        >
          Volver al inicio <app-icon name="flecha" class="h-4 w-4" />
        </a>
      </div>
    </div>
  `,
})
export class EnConstruccion {
  readonly titulo = input('');
}
