#!/usr/bin/env node
/**
 * Arranca `ng serve` apuntando la app a una API: local, dev-tunnel o production.
 *
 *   yarn start:local
 *   yarn start:tunnel
 *   yarn start:prod
 *   yarn start:tunnel -- --port 4300      (el resto de argumentos va a `ng serve`)
 *
 * Cada ambiente usa su propio src/environments/environment.*.ts (fileReplacements en
 * angular.json), a diferencia de Mobile que resuelve la URL en runtime con EXPO_PUBLIC_API_ENV:
 * en Angular el reemplazo es en build, así que aquí solo se valida que el archivo exista y
 * tenga una URL antes de levantar el dev server.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const AMBIENTES = {
  local: { ngConfig: 'development', archivo: 'environment.ts', requerida: false },
  'dev-tunnel': { ngConfig: 'dev-tunnel', archivo: 'environment.dev-tunnel.ts', requerida: true },
  production: { ngConfig: 'production', archivo: 'environment.production.ts', requerida: true },
};

const [ambiente, ...ngArgs] = process.argv.slice(2);
const config = AMBIENTES[ambiente];
if (!config) {
  console.error(`Uso: node scripts/start.js <${Object.keys(AMBIENTES).join('|')}> [argumentos de ng serve]`);
  process.exit(1);
}

const rutaArchivo = path.join(ROOT, 'src', 'environments', config.archivo);

if (!fs.existsSync(rutaArchivo)) {
  console.error(`\n✖ Falta src/environments/${config.archivo} para el ambiente "${ambiente}".`);
  console.error('  Cree el archivo (vea el README) con la URL de ese ambiente.\n');
  process.exit(1);
}

const contenido = fs.readFileSync(rutaArchivo, 'utf8');
const url = contenido.match(/apiUrl:\s*['"]([^'"]*)['"]/)?.[1] ?? '';

if (config.requerida && !url) {
  console.error(`\n✖ src/environments/${config.archivo} no tiene apiUrl para el ambiente "${ambiente}".`);
  console.error('  Complete la URL en ese archivo (vea el README).\n');
  process.exit(1);
}

console.log(`\n▶ API: ${ambiente} → ${url || '(automática: esta PC, puerto 5282)'}\n`);

// El CLI de Angular del proyecto, ejecutado con este mismo Node: sin shell ni npx (igual en Windows)
const ngCli = require.resolve('@angular/cli/bin/ng.js', { paths: [ROOT] });
const hijo = spawn(process.execPath, [ngCli, 'serve', `--configuration=${config.ngConfig}`, ...ngArgs], {
  stdio: 'inherit',
  cwd: ROOT,
});
hijo.on('exit', (code) => process.exit(code ?? 0));
