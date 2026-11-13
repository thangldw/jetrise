import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
// The legacy Sites packaging gate remains in npm test/test:sites. Pages has its
// own executable artifact gate; no game or save tests are excluded here.
const tests=fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);
const r=spawnSync(process.execPath,['--test','--test-skip-pattern=^emits the files required by Sites packaging$',...tests],{stdio:'inherit'});
process.exit(r.status??1);
