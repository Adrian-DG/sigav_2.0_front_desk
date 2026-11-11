import type { TonoBadge } from '../../shared/components/badge/badge';

/** Domain EstadoEvaluacionEnum. "Pendiente" (0) es un evento sin evaluación. */
export const EstadoEvaluacion = { Pendiente: 0, EnGestion: 1, Completada: 2, NoContactado: 3, Rechazada: 4 } as const;
export type EstadoEvaluacion = (typeof EstadoEvaluacion)[keyof typeof EstadoEvaluacion];

export const ESTADO_EVALUACION: Record<EstadoEvaluacion, { label: string; tono: TonoBadge }> = {
  [EstadoEvaluacion.Pendiente]: { label: 'Pendiente', tono: 'warning' },
  [EstadoEvaluacion.EnGestion]: { label: 'En gestión', tono: 'primary' },
  [EstadoEvaluacion.Completada]: { label: 'Completada', tono: 'secondary' },
  [EstadoEvaluacion.NoContactado]: { label: 'No contactado', tono: 'neutral' },
  [EstadoEvaluacion.Rechazada]: { label: 'Rechazada', tono: 'danger' },
};

/** Domain ResultadoContactoEnum. */
export const ResultadoContacto = {
  Contesto: 1,
  NoContesto: 2,
  NumeroEquivocado: 3,
  Buzon: 4,
  RechazoEncuesta: 5,
  MensajeEnviado: 6,
  SinRespuesta: 7,
} as const;
export type ResultadoContacto = (typeof ResultadoContacto)[keyof typeof ResultadoContacto];

export const RESULTADO_CONTACTO: Record<ResultadoContacto, string> = {
  [ResultadoContacto.Contesto]: 'Contestó',
  [ResultadoContacto.NoContesto]: 'No contestó',
  [ResultadoContacto.NumeroEquivocado]: 'Número equivocado',
  [ResultadoContacto.Buzon]: 'Buzón de voz',
  [ResultadoContacto.RechazoEncuesta]: 'No quiso responder',
  [ResultadoContacto.MensajeEnviado]: 'Mensaje enviado',
  [ResultadoContacto.SinRespuesta]: 'Sin respuesta al mensaje',
};

/** Resultados que puede registrar un evaluador por llamada (los de mensajería son del bot). */
export const RESULTADOS_LLAMADA: readonly ResultadoContacto[] = [
  ResultadoContacto.Contesto,
  ResultadoContacto.NoContesto,
  ResultadoContacto.Buzon,
  ResultadoContacto.NumeroEquivocado,
  ResultadoContacto.RechazoEncuesta,
];

/** Domain CanalContactoEnum. */
export const CANAL_CONTACTO: Record<number, string> = { 1: 'Llamada', 2: 'WhatsApp' };

/** Domain TipoPreguntaEnum. */
export const TipoPregunta = { Escala: 1, SiNo: 2, OpcionUnica: 3, Texto: 4 } as const;
export type TipoPregunta = (typeof TipoPregunta)[keyof typeof TipoPregunta];

export const TIPO_PREGUNTA: Record<TipoPregunta, { label: string; ayuda: string }> = {
  [TipoPregunta.Escala]: { label: 'Escala', ayuda: 'Opciones ordenadas; mayor valor = mejor. Se promedia.' },
  [TipoPregunta.SiNo]: { label: 'Sí / No', ayuda: 'Respuesta Sí o No.' },
  [TipoPregunta.OpcionUnica]: { label: 'Opción única', ayuda: 'Una opción de una lista, sin orden.' },
  [TipoPregunta.Texto]: { label: 'Texto libre', ayuda: 'Respuesta abierta.' },
};

export const usaOpciones = (tipo: TipoPregunta): boolean =>
  tipo === TipoPregunta.Escala || tipo === TipoPregunta.OpcionUnica;

/** Domain EstadoEncuestaEnum. */
export const EstadoEncuesta = { Borrador: 1, Publicada: 2, Retirada: 3 } as const;
export type EstadoEncuesta = (typeof EstadoEncuesta)[keyof typeof EstadoEncuesta];

export const ESTADO_ENCUESTA: Record<EstadoEncuesta, { label: string; tono: TonoBadge }> = {
  [EstadoEncuesta.Borrador]: { label: 'Borrador', tono: 'warning' },
  [EstadoEncuesta.Publicada]: { label: 'Vigente', tono: 'secondary' },
  [EstadoEncuesta.Retirada]: { label: 'Retirada', tono: 'neutral' },
};

// ------------------------------------------------ Respuestas de la API (Application/Features/Calidad)

export type BandejaCalidadItem = {
  eventoId: number;
  fechaHoraReporte: string;
  fechaHoraCompletado: string | null;
  tipos: string[];
  unidadFicha: string;
  unidadDenominacion: string;
  tramo: string | null;
  ciudadanoPrincipal: string | null;
  telefono: string | null;
  personasConTelefono: number;
  /** null = pendiente (sin evaluación). */
  estadoEvaluacion: EstadoEvaluacion | null;
  intentos: number;
  ultimoIntento: string | null;
  cerrada: string | null;
};

export type OpcionPregunta = { valor: number; etiqueta: string };

export type PreguntaEncuesta = {
  id: number;
  orden: number;
  texto: string;
  tipo: TipoPregunta;
  obligatoria: boolean;
  permiteComentario: boolean;
  opciones: OpcionPregunta[];
};

export type Encuesta = {
  id: number;
  nombre: string;
  version: number;
  estado: EstadoEncuesta;
  publicada: string | null;
  retirada: string | null;
  preguntas: PreguntaEncuesta[];
};

export type EncuestaListItem = {
  id: number;
  nombre: string;
  version: number;
  estado: EstadoEncuesta;
  publicada: string | null;
  retirada: string | null;
  totalPreguntas: number;
  totalEvaluaciones: number;
};

export type PersonaEvento = {
  eventoCiudadanoId: number;
  rol: number;
  nombre: string;
  identificacion: string | null;
  telefono: string | null;
};

export type EventoCalidad = {
  id: number;
  fechaHoraReporte: string;
  fechaHoraCompletado: string | null;
  tipos: string[];
  direccion: string | null;
  municipio: string | null;
  provincia: string | null;
  tramo: string | null;
  unidadFicha: string;
  unidadDenominacion: string;
  tipoCierre: string | null;
  comentario: string | null;
  personas: PersonaEvento[];
};

export type IntentoContacto = {
  fecha: string;
  canal: number;
  resultado: ResultadoContacto;
  usuario: string | null;
  observacion: string | null;
};

export type Respuesta = { preguntaId: number; valor: number | null; texto: string | null; comentario: string | null };

export type Evaluacion = {
  id: number;
  estado: EstadoEvaluacion;
  canal: number;
  eventoCiudadanoId: number | null;
  nombreContacto: string | null;
  telefonoContacto: string;
  observacion: string | null;
  creada: string;
  creadaPor: string | null;
  cerrada: string | null;
  cerradaPor: string | null;
  intentos: IntentoContacto[];
  respuestas: Respuesta[];
};

export type EvaluacionEvento = {
  evento: EventoCalidad;
  evaluacion: Evaluacion | null;
  /** La versión de la evaluación o, si aún no se inició, la vigente. */
  encuesta: Encuesta | null;
};
