// Copia sql-wasm.wasm (de sql.js, que usa jeep-sqlite) a src/wasm para que
// `ng serve -c tablet-dev` lo sirva en /assets. Solo hace falta en el navegador:
// en Android la base es SQLite nativo.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Se busca desde jeep-sqlite, para usar la misma versión de sql.js que él.
const desdeJeep = createRequire(require.resolve('jeep-sqlite/package.json'));
const origen = desdeJeep.resolve('sql.js/dist/sql-wasm.wasm');

const destino = path.join(aqui, '..', 'src', 'wasm');
mkdirSync(destino, { recursive: true });
copyFileSync(origen, path.join(destino, 'sql-wasm.wasm'));
console.log(`sql-wasm.wasm copiado a ${path.relative(process.cwd(), destino)}`);
