import { httpResource } from '@angular/common/http';
import { Component, computed, input, output } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { fechaHora, mensajeDeError } from '../../../core/utils/formato';
import { Badge } from '../../../shared/components/badge/badge';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import {
  CANAL_REPORTE,
  CATEGORIA_EVENTO,
  ESTADO_EVENTO,
  type EventoDetalle as Detalle,
  ROL_CIUDADANO,
  ROL_UNIDAD,
  SEXO,
  TIPO_EVIDENCIA,
} from '../eventos.model';

/** Detalle de un evento (GET /eventos/{id}) en un diálogo; se abre cuando `eventoId` no es null. */
@Component({
  selector: 'app-evento-detalle',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Badge, Button],
  templateUrl: './evento-detalle.html',
})
export class EventoDetalle {
  readonly eventoId = input<number | null>(null);
  readonly cerrar = output();

  protected readonly ESTADO = ESTADO_EVENTO;
  protected readonly CATEGORIA = CATEGORIA_EVENTO;
  protected readonly CANAL = CANAL_REPORTE;
  protected readonly ROL_UNIDAD = ROL_UNIDAD;
  protected readonly ROL_CIUDADANO = ROL_CIUDADANO;
  protected readonly SEXO = SEXO;
  protected readonly TIPO_EVIDENCIA = TIPO_EVIDENCIA;
  protected readonly fechaHora = fechaHora;

  protected readonly evento = httpResource<Detalle>(() => {
    const id = this.eventoId();
    return id === null ? undefined : `${environment.apiUrl}/eventos/${id}`;
  });
  protected readonly error = computed(() => mensajeDeError(this.evento.error()));
  /** Solo el del evento pedido: al abrir otro no se ve por un instante el anterior. */
  protected readonly detalle = computed(() =>
    this.evento.hasValue() && this.evento.value().id === this.eventoId() ? this.evento.value() : null,
  );

  protected mapa(e: Detalle): string {
    return `https://www.google.com/maps?q=${e.latitud},${e.longitud}`;
  }

  protected nombre(c: Detalle['ciudadanos'][number]): string {
    return `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || 'Persona no identificada';
  }

  /** Placa y descripción; sin marca/modelo la API describe el vehículo con la placa, que no se repite. */
  protected describir(v: Detalle['vehiculos'][number]): string {
    if (!v.placa) return v.descripcion || 'Sin placa';
    return v.descripcion && v.descripcion !== v.placa ? `${v.placa} · ${v.descripcion}` : v.placa;
  }

  protected vehiculo(e: Detalle, id: number | null): string | null {
    const v = id === null ? undefined : e.vehiculos.find((x) => x.id === id);
    return v ? this.describir(v) : null;
  }
}
