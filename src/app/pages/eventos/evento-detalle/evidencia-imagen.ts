import { httpResource } from '@angular/common/http';
import { Component, effect, input, signal } from '@angular/core';

/**
 * Imagen de una evidencia (GET /eventos/{id}/evidencias/{evidenciaId}/archivo). Un <img src> no
 * puede enviar el token, así que se descarga con HttpClient (pasa por el authInterceptor) y se
 * muestra como object URL, que se libera al cambiar de imagen o al destruir el componente.
 */
@Component({
  selector: 'app-evidencia-imagen',
  standalone: true,
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="alt()" class="h-full w-full" [class]="ajuste() === 'contener' ? 'object-contain' : 'object-cover'" />
    } @else if (archivo.error()) {
      <span class="flex h-full w-full items-center justify-center p-2 text-center text-xs text-danger-700">
        No se pudo cargar la imagen.
      </span>
    } @else {
      <span class="block h-full w-full animate-pulse bg-neutral-100"></span>
    }
  `,
  host: { class: 'block overflow-hidden' },
})
export class EvidenciaImagen {
  /** URL de la API del archivo. */
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly ajuste = input<'cubrir' | 'contener'>('cubrir');

  protected readonly archivo = httpResource.blob(() => this.src());
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
}
