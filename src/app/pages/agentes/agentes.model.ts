/** Domain/Enums AreaOperativaEnum. */
export const AREAS_OPERATIVAS: Record<number, string> = {
  1: 'Asistencia vial',
  2: 'Gestión operativa',
  3: 'Seguridad ciudadana',
  4: 'Taller',
  5: 'Grúas',
  6: 'Prehospitalaria',
  7: 'Rescate',
};

/** Mirrors Application/Features/Operaciones/Agentes/AgenteViewModels.cs AgenteViewModel. */
export type Agente = {
  id: number;
  identificacion: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  sexo: number;
  institucion: number;
  rangoId: number;
  rango: string;
  areaOperativa: number;
  accesoTotal: boolean;
  especialidad: string | null;
  autorizado: boolean;
  isActive: boolean;
  createdAt: string;
};

/** POST /agentes/importar (Agentes/ImportarAgentes.cs ImportacionAgentesResult). */
export type ImportacionAgentesResultado = {
  /** true: se guardó. false: vista previa, o hubo errores y no se guardó nada. */
  aplicado: boolean;
  totalFilas: number;
  conErrores: number;
  sinCambios: number;
  agentesCreados: number;
  agentesActualizados: number;
  filas: {
    fila: number;
    identificacion: string;
    nombre: string;
    estado: 'error' | 'sin-cambios' | 'cambios';
    agenteNuevo: boolean;
    cambios: string[];
    errores: string[];
  }[];
};
