import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Badge } from '../../../shared/components/badge/badge';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import type { ImportacionAgentesResultado } from '../agentes.model';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Carga masiva de agentes desde Excel (POST /agentes/importar). Dos pasos: primero se analiza el
 * archivo (aplicar=false) y se muestra qué pasará con cada fila; si no hay errores se confirma
 * (aplicar=true) y la API guarda todo en una sola transacción.
 */
@Component({
  selector: 'app-importar-agentes',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Badge],
  templateUrl: './importar-agentes.html',
})
export class ImportarAgentes {
  private readonly http = inject(HttpClient);

  readonly abierto = input(false);
  readonly cerrar = output();
  readonly importado = output<ImportacionAgentesResultado>();

  protected readonly archivo = signal<File | null>(null);
  protected readonly analisis = signal<ImportacionAgentesResultado | null>(null);
  protected readonly enviando = signal<'analizar' | 'aplicar' | null>(null);
  protected readonly descargando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Solo las filas con errores o con cambios (las sin cambios se cuentan pero no se listan). */
  protected readonly soloRelevantes = signal(true);

  protected readonly filas = computed(() => {
    const filas = this.analisis()?.filas ?? [];
    return this.soloRelevantes() ? filas.filter((f) => f.estado !== 'sin-cambios') : filas;
  });

  protected readonly puedeAplicar = computed(() => {
    const a = this.analisis();
    return !!a && a.conErrores === 0 && a.sinCambios < a.totalFilas;
  });

  constructor() {
    // Cada vez que se abre: sin archivo ni análisis previo
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => {
        this.archivo.set(null);
        this.analisis.set(null);
        this.error.set(null);
        this.soloRelevantes.set(true);
      });
    });
  }

  protected elegir(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.analisis.set(null);
    this.error.set(null);
    if (archivo && !archivo.name.toLowerCase().endsWith('.xlsx')) {
      this.error.set('El archivo debe ser un libro de Excel (.xlsx).');
      this.archivo.set(null);
      input.value = '';
      return;
    }
    if (archivo && archivo.size > MAX_BYTES) {
      this.error.set('El archivo no puede pasar de 5 MB.');
      this.archivo.set(null);
      input.value = '';
      return;
    }
    this.archivo.set(archivo);
  }

  protected analizar(): void {
    this.enviar(false);
  }

  protected aplicar(): void {
    if (this.puedeAplicar()) this.enviar(true);
  }

  protected cancelar(): void {
    if (!this.enviando()) this.cerrar.emit();
  }

  protected descargarPlantilla(): void {
    if (this.descargando()) return;
    this.descargando.set(true);
    this.http.get(`${environment.apiUrl}/agentes/importar/plantilla`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.descargando.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla-agentes.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => {
        this.descargando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  private enviar(aplicar: boolean): void {
    const archivo = this.archivo();
    if (!archivo) {
      this.error.set('Seleccione el archivo de Excel (.xlsx).');
      return;
    }
    if (this.enviando()) return;

    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    datos.append('aplicar', String(aplicar));

    this.enviando.set(aplicar ? 'aplicar' : 'analizar');
    this.error.set(null);
    this.http.post<ImportacionAgentesResultado>(`${environment.apiUrl}/agentes/importar`, datos).subscribe({
      next: (resultado) => {
        this.enviando.set(null);
        if (resultado.aplicado) this.importado.emit(resultado);
        else {
          this.analisis.set(resultado);
          // Si al aplicar aparecieron errores (otro usuario cambió algo entre el análisis y la confirmación)
          if (aplicar) this.error.set('No se guardó nada: el archivo tiene filas con errores. Revíselas y vuelva a intentarlo.');
        }
      },
      error: (error: unknown) => {
        this.enviando.set(null);
        const errores = error instanceof ApiError && error.errors ? Object.values(error.errors).flat() : [];
        this.error.set(errores.length ? errores.join(' ') : mensajeDeError(error));
      },
    });
  }
}
