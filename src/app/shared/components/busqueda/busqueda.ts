import { Component, DestroyRef, inject, input, linkedSignal, model } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Campo de búsqueda para las barras de filtros. Actualiza `valor` cuando el usuario deja de
 * escribir (espera `espera` ms), para no pedir a la API una página por cada tecla.
 */
@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="relative">
      <app-icon
        name="buscar"
        class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        type="search"
        class="control w-full pr-9 pl-9"
        [placeholder]="placeholder()"
        [value]="texto()"
        (input)="escribir($any($event.target).value)"
        (keydown.enter)="aplicar()"
      />
      @if (texto()) {
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          class="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          (click)="limpiar()"
        >
          <app-icon name="limpiar" class="h-4 w-4" />
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class Busqueda {
  readonly valor = model('');
  readonly placeholder = input('Buscar…');
  readonly espera = input(350);

  // Lo escrito; vuelve a `valor` si el padre lo cambia (p. ej. "Limpiar filtros")
  protected readonly texto = linkedSignal(() => this.valor());
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  protected escribir(texto: string): void {
    this.texto.set(texto);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.aplicar(), this.espera());
  }

  protected aplicar(): void {
    clearTimeout(this.temporizador);
    const limpio = this.texto().trim();
    if (limpio !== this.valor()) this.valor.set(limpio);
  }

  protected limpiar(): void {
    this.texto.set('');
    this.aplicar();
  }
}
