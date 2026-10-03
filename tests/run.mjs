// Corre los tests ya compilados (funciona igual en Windows, Mac y Linux).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = join(process.cwd(), '.test-build', 'tests');
const files = readdirSync(dir).filter(f => f.endsWith('.test.js')).map(f => join(dir, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
