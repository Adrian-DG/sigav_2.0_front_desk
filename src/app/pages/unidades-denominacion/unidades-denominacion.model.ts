import type { TonoBadge } from '../../shared/components/badge/badge';

/** Domain/Enums JerarquiaEnum: nivel de la denominación (regional, tramo o unidad). */
export const JERARQUIA: Record<number, { label: string; tono: TonoBadge }> = {
  1: { label: 'Regional', tono: 'accent' },
  2: { label: 'Tramo', tono: 'primary' },
  3: { label: 'Unidad', tono: 'neutral' },
};

/** Mirrors Application/Features/Operaciones/Unidades/UnidadViewModels.cs UnidadViewModel. */
export type Unidad = {
  id: number;
  ficha: string;
  placa: string | null;
  denominacionId: number | null;
  denominacion: string;
  nivelDenominacionId: number | null;
  nivelDenominacion: string;
  tramoId: number | null;
  tramo: string;
  estaDisponible: boolean;
  isActive: boolean;
};

/** Mirrors Application/Features/Operaciones/Denominaciones/DenominacionViewModel.cs DenominacionViewModel. */
export type Denominacion = {
  id: number;
  nombre: string;
  nivelDenominacionId: number;
  nivelDenominacion: string;
  jerarquia: number;
  tramoId: number;
  tramo: string;
};
