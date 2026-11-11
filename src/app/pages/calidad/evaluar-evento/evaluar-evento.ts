import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AvisosService } from '../../../core/services/avisos.service';
import { fechaHora, mensajeDeError } from '../../../core/utils/formato';
import { huella } from '../../../core/utils/huella';
import { Badge } from '../../../shared/components/badge/badge';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { ROL_CIUDADANO } from '../../eventos/eventos.model';
import {
  CANAL_CONTACTO,
  ESTADO_EVALUACION,
  EstadoEvaluacion,
  RESULTADO_CONTACTO,
  RESULTADOS_LLAMADA,
  ResultadoContacto,
  TipoPregunta,
  type EvaluacionEvento,
  type PreguntaEncuesta,
} from '../calidad.model';

type RespuestaLocal = { valor: number | null; texto: string; comentario: string };
/** Persona del evento a contactar, u "otro" número (familiar, etc.). */
type Contacto = number | 'otro' | null;

/**
 * Evaluación de calidad de un evento (GET /calidad/eventos/{id}), en tres pasos:
 * 1) a quién contactar (una persona del evento con teléfono u otro número) → inicia la evaluación;
 * 2) intentos de llamada (no contestó, buzón...); al registrar "Contestó" se habilita la encuesta,
 *    o se cierra como "No contactado" si no se logra;
 * 3) la encuesta de la versión de la evaluación, que puede guardarse a medias y completarse.
 * Una evaluación cerrada se muestra en solo lectura y puede reabrirse para corregirla.
 */
@Component({
  selector: 'app-evaluar-evento',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Badge],
  templateUrl: './evaluar-evento.html',
})
export class EvaluarEvento {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  /** null: cerrado. */
  readonly eventoId = input<number | null>(null);
  readonly cerrar = output();
  /** Algo cambió en la evaluación: la bandeja debe recargarse. */
  readonly cambiado = output();

  protected readonly ESTADO = ESTADO_EVALUACION;
  protected readonly RESULTADO = RESULTADO_CONTACTO;
  protected readonly CANAL = CANAL_CONTACTO;
  protected readonly ROL = ROL_CIUDADANO;
  protected readonly TipoPregunta = TipoPregunta;
  protected readonly resultadosLlamada = RESULTADOS_LLAMADA;
  protected readonly fechaHora = fechaHora;

  protected readonly datos = httpResource<EvaluacionEvento>(() =>
    this.eventoId() === null ? undefined : `${environment.apiUrl}/calidad/eventos/${this.eventoId()}`,
  );
  protected readonly vm = computed(() => (this.datos.hasValue() ? this.datos.value() : undefined));
  protected readonly lugar = computed(() => {
    const ev = this.vm()?.evento;
    return ev ? [ev.direccion, ev.municipio, ev.provincia].filter((x) => !!x).join(', ') || '—' : '';
  });
  protected readonly errorCarga = computed(() => mensajeDeError(this.datos.error()));

  protected readonly evaluacion = computed(() => this.vm()?.evaluacion ?? null);
  protected readonly encuesta = computed(() => this.vm()?.encuesta ?? null);
  protected readonly enGestion = computed(() => this.evaluacion()?.estado === EstadoEvaluacion.EnGestion);
  protected readonly contesto = computed(
    () => !!this.evaluacion()?.intentos.some((i) => i.resultado === ResultadoContacto.Contesto),
  );
  protected readonly puedeResponder = computed(() => this.enGestion() && this.contesto());
  protected readonly puedeCerrarSinContacto = computed(
    () => this.enGestion() && !this.contesto() && (this.evaluacion()?.intentos.length ?? 0) > 0,
  );

  protected readonly ocupado = signal(false);
  protected readonly errorAccion = signal<string | null>(null);

  // ------------------------------------------------ 1. Contacto

  protected readonly editandoContacto = signal(false);
  protected readonly contacto = linkedSignal<Contacto>(() => {
    const vm = this.vm();
    if (!vm) return null;
    if (vm.evaluacion) return vm.evaluacion.eventoCiudadanoId ?? 'otro';
    return vm.evento.personas.find((p) => p.telefono)?.eventoCiudadanoId ?? (vm.evento.personas.length ? null : 'otro');
  });
  protected readonly telefono = linkedSignal(() => {
    const ev = this.vm()?.evaluacion;
    return ev && !ev.eventoCiudadanoId ? ev.telefonoContacto : '';
  });
  protected readonly nombreContacto = linkedSignal(() => {
    const ev = this.vm()?.evaluacion;
    return ev && !ev.eventoCiudadanoId ? (ev.nombreContacto ?? '') : '';
  });

  /** La persona elegida no tiene teléfono (o es "otro"): hay que escribirlo. */
  protected readonly pideTelefono = computed(() => {
    const c = this.contacto();
    if (c === 'otro') return true;
    if (c === null) return false;
    return !this.vm()?.evento.personas.find((p) => p.eventoCiudadanoId === c)?.telefono;
  });

  private cuerpoContacto() {
    const c = this.contacto();
    return {
      eventoCiudadanoId: typeof c === 'number' ? c : null,
      telefono: this.pideTelefono() ? this.telefono().trim() || null : null,
      nombreContacto: c === 'otro' ? this.nombreContacto().trim() || null : null,
    };
  }

  protected iniciar(): void {
    if (this.contacto() === null) {
      this.errorAccion.set('Elija a quién contactar.');
      return;
    }
    this.ejecutar(this.http.post(this.url('evaluacion'), this.cuerpoContacto()), 'Evaluación iniciada: registre el resultado de la llamada.');
  }

  protected guardarContacto(): void {
    this.ejecutar(this.http.put(this.url('evaluacion/contacto'), this.cuerpoContacto()), 'Contacto actualizado.', () =>
      this.editandoContacto.set(false),
    );
  }

  // ------------------------------------------------ 2. Intentos

  protected readonly resultado = signal<ResultadoContacto | null>(null);
  protected readonly observacionIntento = signal('');
  protected readonly observacionCierre = linkedSignal(() => this.vm()?.evaluacion?.observacion ?? '');

  protected elegirResultado(valor: string): void {
    this.resultado.set(valor ? (Number(valor) as ResultadoContacto) : null);
  }

  protected registrarIntento(): void {
    const resultado = this.resultado();
    if (resultado === null) {
      this.errorAccion.set('Indique el resultado de la llamada.');
      return;
    }
    const texto =
      resultado === ResultadoContacto.Contesto
        ? 'Llamada registrada: ya puede tomar la encuesta.'
        : resultado === ResultadoContacto.RechazoEncuesta
          ? 'Evaluación cerrada: el ciudadano no quiso responder.'
          : 'Intento registrado.';
    this.ejecutar(
      this.http.post(this.url('evaluacion/intentos'), { resultado, observacion: this.observacionIntento().trim() || null }),
      texto,
      () => {
        this.resultado.set(null);
        this.observacionIntento.set('');
      },
    );
  }

  protected marcarNoContactado(): void {
    this.ejecutar(
      this.http.post(this.url('evaluacion/no-contactado'), { observacion: this.observacionCierre().trim() || null }),
      'Evaluación cerrada como "No contactado".',
    );
  }

  protected reabrir(): void {
    this.ejecutar(this.http.post(this.url('evaluacion/reabrir'), {}), 'Evaluación reabierta.');
  }

  // ------------------------------------------------ 3. Encuesta

  /** Respuestas en edición, por Id de pregunta; se reinician con cada carga. */
  protected readonly respuestas = linkedSignal<Record<number, RespuestaLocal>>(() => this.respuestasGuardadas());
  private readonly respuestasGuardadas = computed(() => {
    const mapa: Record<number, RespuestaLocal> = {};
    const guardadas = this.evaluacion()?.respuestas ?? [];
    for (const p of this.encuesta()?.preguntas ?? []) {
      const r = guardadas.find((x) => x.preguntaId === p.id);
      mapa[p.id] = { valor: r?.valor ?? null, texto: r?.texto ?? '', comentario: r?.comentario ?? '' };
    }
    return mapa;
  });
  protected readonly sucio = computed(
    () => this.puedeResponder() && huella(this.respuestas()) !== huella(this.respuestasGuardadas()),
  );

  protected readonly faltantes = computed(() =>
    (this.encuesta()?.preguntas ?? [])
      .filter((p) => p.obligatoria && !this.respondida(p))
      .map((p) => p.orden),
  );

  protected respuesta(p: PreguntaEncuesta): RespuestaLocal {
    return this.respuestas()[p.id] ?? { valor: null, texto: '', comentario: '' };
  }

  protected respondida(p: PreguntaEncuesta): boolean {
    const r = this.respuesta(p);
    return p.tipo === TipoPregunta.Texto ? !!r.texto.trim() : r.valor !== null;
  }

  protected opciones(p: PreguntaEncuesta) {
    return p.tipo === TipoPregunta.SiNo
      ? [
          { valor: 1, etiqueta: 'Sí' },
          { valor: 0, etiqueta: 'No' },
        ]
      : p.opciones;
  }

  protected elegir(p: PreguntaEncuesta, valor: number): void {
    if (!this.puedeResponder()) return;
    // Volver a tocar la opción elegida la quita
    this.cambiar(p, { valor: this.respuesta(p).valor === valor ? null : valor });
  }

  protected cambiar(p: PreguntaEncuesta, cambio: Partial<RespuestaLocal>): void {
    this.respuestas.update((r) => ({ ...r, [p.id]: { ...this.respuesta(p), ...cambio } }));
  }

  protected guardar(completar: boolean): void {
    const encuesta = this.encuesta();
    if (!encuesta) return;
    if (completar && this.faltantes().length) {
      this.errorAccion.set(`Faltan preguntas obligatorias: ${this.faltantes().join(', ')}.`);
      return;
    }
    const respuestas = encuesta.preguntas.map((p) => {
      const r = this.respuesta(p);
      return {
        preguntaId: p.id,
        valor: p.tipo === TipoPregunta.Texto ? null : r.valor,
        texto: p.tipo === TipoPregunta.Texto ? r.texto.trim() || null : null,
        // Sin respuesta no se guarda comentario (la API lo rechaza)
        comentario: this.respondida(p) && p.permiteComentario ? r.comentario.trim() || null : null,
      };
    });
    this.ejecutar(
      this.http.put(this.url('evaluacion/respuestas'), {
        respuestas,
        completar,
        observacion: completar ? this.observacionCierre().trim() || null : null,
      }),
      completar ? 'Encuesta completada.' : 'Avance guardado.',
    );
  }

  // ------------------------------------------------ Común

  private url(ruta: string): string {
    return `${environment.apiUrl}/calidad/eventos/${this.eventoId()}/${ruta}`;
  }

  private ejecutar(peticion: Observable<unknown>, exito: string, alTerminar?: () => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    peticion.subscribe({
      next: () => {
        this.ocupado.set(false);
        alTerminar?.();
        this.avisos.exito(exito);
        this.datos.reload();
        this.cambiado.emit();
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeDeError(error) ?? 'No se pudo completar la operación.');
      },
    });
  }

  protected alCerrar(): void {
    this.errorAccion.set(null);
    this.editandoContacto.set(false);
    this.resultado.set(null);
    this.observacionIntento.set('');
    this.cerrar.emit();
  }
}
