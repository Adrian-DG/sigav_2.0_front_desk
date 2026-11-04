import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';
import { switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Permisos } from '../../../core/permissions/permisos';
import { AvisosService } from '../../../core/services/avisos.service';
import { fecha, mensajeDeError } from '../../../core/utils/formato';
import { huella } from '../../../core/utils/huella';
import { Badge } from '../../../shared/components/badge/badge';
import { Button } from '../../../shared/components/button/button';
import { EstadoLista } from '../../../shared/components/estado-lista/estado-lista';
import { Icon } from '../../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones } from '../../../shared/components/module-page/module-page';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  ESTADO_ENCUESTA,
  EstadoEncuesta,
  TIPO_PREGUNTA,
  TipoPregunta,
  usaOpciones,
  type Encuesta,
  type EncuestaListItem,
} from '../calidad.model';

type OpcionForm = { valor: number; etiqueta: string };
type PreguntaForm = {
  /** Solo para el track del @for (las preguntas no tienen Id hasta guardarse). */
  clave: number;
  texto: string;
  tipo: TipoPregunta;
  obligatoria: boolean;
  permiteComentario: boolean;
  opciones: OpcionForm[];
};
type BorradorForm = { nombre: string; preguntas: PreguntaForm[] };

const MAX_PREGUNTAS = 30;
const MAX_OPCIONES = 10;
const ESCALA_INICIAL = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/**
 * Versiones de la encuesta de calidad (GET /calidad/encuestas). Las preguntas cambian creando una
 * nueva versión (copia de la vigente), editándola y publicándola: la anterior queda retirada y las
 * evaluaciones que la usaron la conservan. Solo un borrador a la vez; una versión publicada no se edita.
 */
@Component({
  selector: 'app-encuestas',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, EstadoLista, Badge, Button, Icon, RouterLink, HasPermissionDirective],
  templateUrl: './encuestas.html',
})
export class Encuestas {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  protected readonly ESTADO = ESTADO_ENCUESTA;
  protected readonly TIPO = TIPO_PREGUNTA;
  protected readonly tipos = Object.entries(TIPO_PREGUNTA).map(([valor, t]) => ({ valor: Number(valor) as TipoPregunta, label: t.label }));
  protected readonly usaOpciones = usaOpciones;
  protected readonly fecha = fecha;
  protected readonly maxPreguntas = MAX_PREGUNTAS;
  protected readonly maxOpciones = MAX_OPCIONES;
  protected readonly permisoCalidad = Permisos.Calidad;

  protected readonly versiones = httpResource<EncuestaListItem[]>(() => `${environment.apiUrl}/calidad/encuestas`);
  protected readonly lista = computed(() => (this.versiones.hasValue() ? this.versiones.value() : []));
  protected readonly errorLista = computed(() => mensajeDeError(this.versiones.error()));
  protected readonly hayBorrador = computed(() => this.lista().some((v) => v.estado === EstadoEncuesta.Borrador));

  /** Versión abierta: por defecto el borrador o, si no hay, la vigente. */
  protected readonly seleccionada = linkedSignal<number | null>(() => {
    const lista = this.lista();
    return (
      lista.find((v) => v.estado === EstadoEncuesta.Borrador)?.id ??
      lista.find((v) => v.estado === EstadoEncuesta.Publicada)?.id ??
      lista[0]?.id ??
      null
    );
  });

  protected readonly detalle = httpResource<Encuesta>(() =>
    this.seleccionada() === null ? undefined : `${environment.apiUrl}/calidad/encuestas/${this.seleccionada()}`,
  );
  protected readonly encuesta = computed(() => (this.detalle.hasValue() ? this.detalle.value() : null));
  protected readonly esBorrador = computed(() => this.encuesta()?.estado === EstadoEncuesta.Borrador);

  // ------------------------------------------------ Borrador

  private siguienteClave = 1;
  private readonly original = computed<BorradorForm | null>(() => {
    const e = this.encuesta();
    if (!e) return null;
    return {
      nombre: e.nombre,
      preguntas: e.preguntas.map((p) => ({
        clave: p.id,
        texto: p.texto,
        tipo: p.tipo,
        obligatoria: p.obligatoria,
        permiteComentario: p.permiteComentario,
        opciones: p.opciones.map((o) => ({ ...o })),
      })),
    };
  });
  protected readonly form = linkedSignal<BorradorForm | null>(() => this.original());
  protected readonly sucio = computed(() => {
    const quitarClaves = (f: BorradorForm | null) => f && { ...f, preguntas: f.preguntas.map(({ clave: _, ...p }) => p) };
    return this.esBorrador() && huella(quitarClaves(this.form())) !== huella(quitarClaves(this.original()));
  });

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmandoPublicar = signal(false);
  protected readonly confirmandoDescartar = signal(false);

  protected cambiarNombre(nombre: string): void {
    this.form.update((f) => f && { ...f, nombre });
  }

  protected cambiarPregunta(indice: number, cambio: Partial<PreguntaForm>): void {
    this.form.update((f) => {
      if (!f) return f;
      const preguntas = [...f.preguntas];
      const actual = preguntas[indice];
      const siguiente = { ...actual, ...cambio };
      // Al pasar a escala u opción única sin opciones se proponen unas
      if (cambio.tipo !== undefined) {
        if (!usaOpciones(cambio.tipo)) siguiente.opciones = [];
        else if (siguiente.opciones.length === 0)
          siguiente.opciones =
            cambio.tipo === TipoPregunta.Escala
              ? ESCALA_INICIAL.map((etiqueta, i) => ({ valor: i + 1, etiqueta }))
              : [
                  { valor: 1, etiqueta: 'Opción 1' },
                  { valor: 2, etiqueta: 'Opción 2' },
                ];
        if (cambio.tipo === TipoPregunta.Texto) siguiente.permiteComentario = false;
      }
      preguntas[indice] = siguiente;
      return { ...f, preguntas };
    });
  }

  protected cambiarTipo(indice: number, valor: string): void {
    this.cambiarPregunta(indice, { tipo: Number(valor) as TipoPregunta });
  }

  protected agregarPregunta(): void {
    this.form.update(
      (f) =>
        f && {
          ...f,
          preguntas: [
            ...f.preguntas,
            {
              clave: -this.siguienteClave++,
              texto: '',
              tipo: TipoPregunta.Escala,
              obligatoria: true,
              permiteComentario: true,
              opciones: ESCALA_INICIAL.map((etiqueta, i) => ({ valor: i + 1, etiqueta })),
            },
          ],
        },
    );
  }

  protected quitarPregunta(indice: number): void {
    this.form.update((f) => f && { ...f, preguntas: f.preguntas.filter((_, i) => i !== indice) });
  }

  protected moverPregunta(indice: number, delta: -1 | 1): void {
    this.form.update((f) => {
      if (!f) return f;
      const destino = indice + delta;
      if (destino < 0 || destino >= f.preguntas.length) return f;
      const preguntas = [...f.preguntas];
      [preguntas[indice], preguntas[destino]] = [preguntas[destino], preguntas[indice]];
      return { ...f, preguntas };
    });
  }

  protected cambiarOpcion(pregunta: number, opcion: number, etiqueta: string): void {
    const p = this.form()!.preguntas[pregunta];
    this.cambiarPregunta(pregunta, { opciones: p.opciones.map((o, i) => (i === opcion ? { ...o, etiqueta } : o)) });
  }

  protected agregarOpcion(pregunta: number): void {
    const p = this.form()!.preguntas[pregunta];
    const valor = Math.max(0, ...p.opciones.map((o) => o.valor)) + 1;
    this.cambiarPregunta(pregunta, { opciones: [...p.opciones, { valor, etiqueta: '' }] });
  }

  /** Los valores se renumeran 1..n: en una escala el orden de la lista es de peor a mejor. */
  protected quitarOpcion(pregunta: number, opcion: number): void {
    const p = this.form()!.preguntas[pregunta];
    this.cambiarPregunta(pregunta, {
      opciones: p.opciones.filter((_, i) => i !== opcion).map((o, i) => ({ ...o, valor: i + 1 })),
    });
  }

  // ------------------------------------------------ Acciones

  protected nuevaVersion(): void {
    this.ejecutar(this.http.post<{ id: number }>(`${environment.apiUrl}/calidad/encuestas/nueva-version`, {}), 'Se creó el borrador de la nueva versión.');
  }

  protected guardar(): void {
    this.ejecutar(this.guardarBorrador(), 'Borrador guardado.');
  }

  protected publicar(): void {
    this.confirmandoPublicar.set(false);
    const id = this.seleccionada();
    // Se guarda lo que haya en pantalla y luego se publica
    this.ejecutar(
      this.guardarBorrador().pipe(switchMap(() => this.http.post(`${environment.apiUrl}/calidad/encuestas/${id}/publicar`, {}))),
      'Versión publicada: las evaluaciones nuevas la usarán.',
    );
  }

  protected descartar(): void {
    this.confirmandoDescartar.set(false);
    this.ejecutar(this.http.delete(`${environment.apiUrl}/calidad/encuestas/${this.seleccionada()}`), 'Borrador descartado.', true);
  }

  protected deshacerCambios(): void {
    this.form.set(this.original());
  }

  private guardarBorrador(): Observable<unknown> {
    const f = this.form()!;
    return this.http.put(`${environment.apiUrl}/calidad/encuestas/${this.seleccionada()}`, {
      nombre: f.nombre.trim(),
      preguntas: f.preguntas.map((p) => ({
        texto: p.texto.trim(),
        tipo: p.tipo,
        obligatoria: p.obligatoria,
        permiteComentario: p.permiteComentario,
        opciones: usaOpciones(p.tipo) ? p.opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta.trim() })) : null,
      })),
    });
  }

  private ejecutar(peticion: Observable<unknown>, exito: string, reseleccionar = false): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.avisos.exito(exito);
        const nuevoId = (r as { id?: number } | null)?.id;
        this.versiones.reload();
        if (nuevoId) this.seleccionada.set(nuevoId);
        else if (!reseleccionar) this.detalle.reload();
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(error) ?? 'No se pudo completar la operación.');
      },
    });
  }
}
