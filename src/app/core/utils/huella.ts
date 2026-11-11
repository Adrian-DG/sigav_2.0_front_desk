/**
 * Texto que identifica el contenido de un formulario, para saber si cambió desde que se abrió
 * (`sucio`). Los Set se comparan por sus elementos, sin importar el orden.
 */
export function huella(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v: unknown) => (v instanceof Set ? [...v].map(String).sort() : v));
}
