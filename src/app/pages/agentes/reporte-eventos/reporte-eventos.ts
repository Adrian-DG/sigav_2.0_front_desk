import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { INSTITUCIONES } from '../../../core/models/catalogos';
import { diasDelRango, hoyRD, mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Filtro } from '../../../shared/components/filtro/filtro';
import { Icon } from '../../../shared/components/icon/icon';
import { AREAS_OPERATIVAS } from '../agentes.model';

/** Igual que ExportarEventosPorAgenteQueryValidator.MaxDias en la API. */
const MAX_DIAS = 366;

/**
 * Excel de eventos atendidos por agente (GET /agentes/reporte-eventos): asistencias, accidentes y
 * total en un rango de fechas, con la opción de desglosarlo por mes y de limitarlo a un área
 * operativa o institución.
 */
@Component({
  selector: 'app-reporte-eventos',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Filtro, Icon],
  templateUrl: './reporte-eventos.html',
})
export class ReporteEventos {
  private readonly http = inject(HttpClient);

  readonly abierto = input(false);
  readonly cerrar = output();

  protected readonly areas = Object.entries(AREAS_OPERATIVAS).map(([valor, label]) => ({ valor: Number(valor), label }));
  protected readonly instituciones = Object.entries(INSTITUCIONES)
    .filter(([valor]) => valor !== '0')
    .map(([valor, label]) => ({ valor: Number(valor), label }));

  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly mensual = signal(true);
  protected readonly area = signal<number | null>(null);
  protected readonly institucion = signal<number | null>(null);
  protected readonly descargando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Cada vez que se abre: el mes en curso
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => this.usarPeriodo('mes'));
    });
  }

  /** Atajos de rango: mes en curso, mes anterior o año en curso (hasta hoy). */
  protected usarPeriodo(periodo: 'mes' | 'mes-anterior' | 'anio'): void {
    const hoy = hoyRD();
    const [anio, mes] = hoy.split('-').map(Number);
    this.error.set(null);
    if (periodo === 'mes') {
      this.desde.set(`${hoy.slice(0, 7)}-01`);
      this.hasta.set(hoy);
    } else if (periodo === 'mes-anterior') {
      const inicio = new Date(Date.UTC(anio, mes - 2, 1));
      const fin = new Date(Date.UTC(anio, mes - 1, 0));
      this.desde.set(inicio.toISOString().slice(0, 10));
      this.hasta.set(fin.toISOString().slice(0, 10));
    } else {
      this.desde.set(`${anio}-01-01`);
      this.hasta.set(hoy);
    }
  }

  protected descargar(): void {
    if (this.descargando()) return;
    const desde = this.desde();
    const hasta = this.hasta();
    if (!desde || !hasta) {
      this.error.set('Indique el rango de fechas.');
      return;
    }
    if (desde > hasta) {
      this.error.set('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    if (diasDelRango(desde, hasta) > MAX_DIAS) {
      this.error.set(`El rango no puede superar ${MAX_DIAS} días.`);
      return;
    }

    this.error.set(null);
    this.descargando.set(true);
    const params: Record<string, string | number | boolean> = { desde, hasta, mensual: this.mensual() };
    if (this.area() !== null) params['areaOperativa'] = this.area()!;
    if (this.institucion() !== null) params['institucion'] = this.institucion()!;

    this.http
      .get(`${environment.apiUrl}/agentes/reporte-eventos`, { params, responseType: 'blob', observe: 'response' })
      .subscribe({
        next: (respuesta) => {
          this.descargando.set(false);
          const nombre =
            /filename="?([^";]+)"?/.exec(respuesta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'eventos_por_agente.xlsx';
          const url = URL.createObjectURL(respuesta.body!);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => {
          this.descargando.set(false);
          this.error.set(mensajeDeError(error) ?? 'No se pudo generar el reporte.');
        },
      });
  }

  protected numeroONulo(valor: string): number | null {
    return valor ? Number(valor) : null;
  }
}
