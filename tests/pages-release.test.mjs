import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validatePages} from '../scripts/pages-release.mjs';
test('public Pages boundary rejects source, maps and symlinks rather than copying private checkout',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pages-boundary-'));
 try{
  fs.mkdirSync(path.join(root,'assets'));
  fs.writeFileSync(path.join(root,'index.html'),'<script src="/jetrise/assets/game.js"></script><link href="/jetrise/assets/game.css">');
  fs.writeFileSync(path.join(root,'assets/game.js'),'console.log("game")');fs.writeFileSync(path.join(root,'assets/game.css'),'body{}');
  assert.equal(validatePages(root).length,3);
  for(const file of ['source.js','assets/game.js.map','assets/save.json','.env']){fs.writeFileSync(path.join(root,file),'private');assert.throws(()=>validatePages(root),/forbidden/);fs.unlinkSync(path.join(root,file));}
  fs.symlinkSync(path.join(root,'index.html'),path.join(root,'assets/leak.js'));assert.throws(()=>validatePages(root),/Symlink/);fs.unlinkSync(path.join(root,'assets/leak.js'));
  fs.writeFileSync(path.join(root,'assets/game.js'),'//# sourceMappingURL=secret.map');assert.throws(()=>validatePages(root),/Source map/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
