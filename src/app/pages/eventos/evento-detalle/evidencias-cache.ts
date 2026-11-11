import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';

/** Imágenes guardadas a la vez; las más antiguas se descartan (cada una pesa cientos de KB). */
const MAX_IMAGENES = 60;

/**
 * Archivos de evidencias ya descargados, compartidos por miniaturas, vista ampliada y reaperturas
 * del detalle. Hace falta porque el navegador no los guarda en caché: el Dev Tunnel reemplaza el
 * Cache-Control de la API por no-store, y sin esto cada imagen se descargaba completa cada vez.
 * Una evidencia no cambia nunca, así que no hay que invalidar nada; un error no se guarda, para
 * poder reintentar.
 */
@Injectable({ providedIn: 'root' })
export class EvidenciasCache {
  private readonly http = inject(HttpClient);
  private readonly archivos = new Map<string, Observable<Blob>>();

  obtener(url: string): Observable<Blob> {
    const guardado = this.archivos.get(url);
    if (guardado) {
      // Reinsertar la deja como la más reciente
      this.archivos.delete(url);
      this.archivos.set(url, guardado);
      return guardado;
    }

    const archivo = this.http.get(url, { responseType: 'blob' }).pipe(
      catchError((error: unknown) => {
        this.archivos.delete(url);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.archivos.set(url, archivo);
    if (this.archivos.size > MAX_IMAGENES) this.archivos.delete(this.archivos.keys().next().value!);
    return archivo;
  }
}
