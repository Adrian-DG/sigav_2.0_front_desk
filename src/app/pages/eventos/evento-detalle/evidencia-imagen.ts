import { Component, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { EvidenciasCache } from './evidencias-cache';

/**
 * Imagen de una evidencia (GET /eventos/{id}/evidencias/{evidenciaId}/archivo). Un <img src> no
 * puede enviar el token, así que se descarga con HttpClient (pasa por el authInterceptor) y se
 * muestra como object URL, que se libera al cambiar de imagen o al destruir el componente. La
 * descarga se comparte entre miniatura, vista ampliada y reaperturas (EvidenciasCache): por el
 * Dev Tunnel una foto tarda varios segundos.
 */
@Component({
  selector: 'app-evidencia-imagen',
  standalone: true,
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="alt()" class="h-full w-full" [class]="ajuste() === 'contener' ? 'object-contain' : 'object-cover'" />
    } @else if (archivo.error()) {
      <span class="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-xs" role="alert">
        <span class="text-danger-700">No se pudo cargar la imagen.</span>
        <span class="font-bold text-primary-600 underline">Toque para reintentar</span>
      </span>
    } @else {
      <span class="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-neutral-500" aria-live="polite">
        <svg class="h-6 w-6 animate-spin text-primary-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
        Cargando imagen…
      </span>
    }
  `,
  host: { class: 'block overflow-hidden', '(click)': 'reintentar($event)' },
})
export class EvidenciaImagen {
  /** URL de la API del archivo. */
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly ajuste = input<'cubrir' | 'contener'>('cubrir');

  private readonly cache = inject(EvidenciasCache);

  protected readonly archivo = rxResource({
    params: () => this.src(),
    stream: ({ params }) => this.cache.obtener(params),
  });
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      if (!this.archivo.hasValue()) {
        this.url.set(null);
        return;
      }
      const url = URL.createObjectURL(this.archivo.value());
      this.url.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  /** Tras un error, el clic reintenta la descarga (y no abre la vista ampliada de la miniatura). */
  protected reintentar(event: Event): void {
    if (!this.archivo.error()) return;
    event.stopPropagation();
    this.archivo.reload();
  }
}
