import { httpResource } from '@angular/common/http';
import { Component, computed, input, linkedSignal, output } from '@angular/core';

import { environment } from '../../../../environments/environment';
import type { PagedResult } from '../../../core/models/paged-result';
import { fechaHora, mensajeDeError } from '../../../core/utils/formato';
import { Badge, type TonoBadge } from '../../../shared/components/badge/badge';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Paginador } from '../../../shared/components/paginador/paginador';

/** De qué se muestra el historial: los cambios de una unidad o las unidades que tuvo una denominación. */
export type OrigenHistorial = { tipo: 'unidad' | 'denominacion'; id: number; nombre: string };

/** Mirrors Application/Features/Operaciones/Historial/GetHistorialDenominaciones.cs HistorialDenominacionViewModel. */
type Cambio = {
  id: number;
  fechaUtc: string;
  tipoCambio: number;
  unidadId: number;
  ficha: string;
  denominacionAnteriorId: number | null;
  denominacionAnterior: string | null;
  denominacionNuevaId: number | null;
  denominacionNueva: string | null;
  unidadRelacionadaId: number | null;
  fichaRelacionada: string | null;
  usuarioId: number;
  usuario: string | null;
  observacion: string | null;
};

/** Domain/Enums TipoCambioDenominacionEnum. */
const TIPO_CAMBIO: Record<number, { label: string; tono: TonoBadge }> = {
  1: { label: 'Asignación', tono: 'secondary' },
  2: { label: 'Reasignación', tono: 'primary' },
  3: { label: 'Liberación', tono: 'warning' },
  4: { label: 'Alta', tono: 'neutral' },
};

const TAMANO_PAGINA = 10;

/**
 * Historial de cambios de denominación (tabla HistorialDenominacionUnidad) en un diálogo:
 * GET /unidades/{id}/historial-denominaciones o GET /denominaciones/{id}/historial-unidades.
 */
@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Badge, Button, Paginador],
  templateUrl: './historial.html',
})
export class Historial {
  /** null: cerrado. */
  readonly origen = input<OrigenHistorial | null>(null);
  readonly cerrar = output();

  protected readonly TIPO = TIPO_CAMBIO;
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly fechaHora = fechaHora;

  protected readonly pagina = linkedSignal({ source: this.origen, computation: () => 1 });

  protected readonly historial = httpResource<PagedResult<Cambio>>(() => {
    const o = this.origen();
    if (!o) return undefined;
    const ruta = o.tipo === 'unidad' ? `unidades/${o.id}/historial-denominaciones` : `denominaciones/${o.id}/historial-unidades`;
    return { url: `${environment.apiUrl}/${ruta}`, params: { page: this.pagina(), size: TAMANO_PAGINA } };
  });
  protected readonly error = computed(() => mensajeDeError(this.historial.error()));

  /** Una frase por cambio, desde el punto de vista de la unidad del registro. */
  protected describir(c: Cambio): string {
    const quitada = c.fichaRelacionada ? `, que se le quitó a ${c.fichaRelacionada}` : '';
    switch (c.tipoCambio) {
      case 1:
        return `${c.ficha} recibió la denominación ${c.denominacionNueva ?? '—'}${quitada}.`;
      case 2:
        return `${c.ficha} pasó de ${c.denominacionAnterior ?? '—'} a ${c.denominacionNueva ?? '—'}${quitada}.`;
      case 3:
        return `${c.ficha} perdió la denominación ${c.denominacionAnterior ?? '—'} porque la tomó ${c.fichaRelacionada ?? 'otra unidad'}; quedó No disponible.`;
      case 4:
        return `Se registró la unidad ${c.ficha}.`;
      default:
        return 'Cambio de denominación.';
    }
  }
}
