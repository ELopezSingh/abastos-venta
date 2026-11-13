// Copia sql-wasm.wasm a src/wasm para que `ng serve -c tablet-dev` lo sirva en /assets.
// Solo hace falta en el navegador: en Android la base es SQLite nativo.
//
// El JavaScript de sql.js viene DENTRO de jeep-sqlite, compilado con una versión
// fija; el .wasm debe ser de esa misma versión o falla con
// "LinkError: WebAssembly.instantiate(): Import #34 ...".
// jeep-sqlite 2.8.0 trae el de sql.js 1.11/1.12. Si se actualiza jeep-sqlite,
// hay que revisar qué versión trae y ajustar SQLJS_ESPERADO y package.json.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SQLJS_ESPERADO = '1.12.0';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const origen = require.resolve('sql.js/dist/sql-wasm.wasm');
// sql.js no exporta su package.json; se lee junto a dist/.
const { version } = JSON.parse(
  readFileSync(path.join(path.dirname(origen), '..', 'package.json'), 'utf8'),
);

if (version !== SQLJS_ESPERADO) {
  console.error(
    `sql.js ${version} no coincide con el que trae jeep-sqlite (${SQLJS_ESPERADO}).\n` +
      `Corre: npm install sql.js@${SQLJS_ESPERADO} -w frontend --save-dev --save-exact`,
  );
  process.exit(1);
}

const destino = path.join(aqui, '..', 'src', 'wasm');
mkdirSync(destino, { recursive: true });
copyFileSync(origen, path.join(destino, 'sql-wasm.wasm'));
console.log(`sql-wasm.wasm (sql.js ${version}) copiado a ${path.relative(process.cwd(), destino)}`);
