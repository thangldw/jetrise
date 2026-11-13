import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export function validatePages(root){
 const files=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name),rel=path.relative(root,full).split(path.sep).join('/');
  assert(!entry.isSymbolicLink(),`Symlink forbidden: ${rel}`);
  if(entry.isDirectory()){assert(rel==='assets',`Directory forbidden: ${rel}`);walk(full);continue;}
  assert(entry.isFile(),`Non-file forbidden: ${rel}`);
  assert(rel==='index.html'||rel==='.nojekyll'||/^assets\/[A-Za-z0-9_.-]+\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/.test(rel),`File forbidden: ${rel}`);
  if(/\.(js|css)$/.test(rel))assert(!/sourceMappingURL\s*=/.test(fs.readFileSync(full,'utf8')),`Source map reference: ${rel}`);
  files.push(rel);
 }}
 walk(root);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(/\/jetrise\/assets\//.test(html),'Missing production asset prefix');
 for(const ref of html.matchAll(/(?:src|href)="(\/jetrise\/[^"?#]+)"/g))assert(fs.statSync(path.join(root,ref[1].slice('/jetrise/'.length))).isFile(),`Missing asset: ${ref[1]}`);
 assert(files.some(f=>f.endsWith('.js'))&&files.some(f=>f.endsWith('.css')),'Missing JS/CSS');
 return files.sort();
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify({files:validatePages(process.argv[2]||'dist/client')}));
