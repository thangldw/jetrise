import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, relative} from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const root = fileURLToPath(new URL('../', import.meta.url));

function unboundComponents(source) {
  const missing = [];
  const ast = parse(source, {sourceType: 'module', plugins: ['jsx']});
  traverse(ast, {
    JSXOpeningElement(path) {
      let name = path.node.name;
      const member = name.type === 'JSXMemberExpression';
      while (name.type === 'JSXMemberExpression') name = name.object;
      // Intrinsic tags need no binding; member tags resolve their root object.
      if (name.type !== 'JSXIdentifier' || name.name === 'this' || (!member && /^[a-z]/.test(name.name))) return;
      if (!path.scope.getBinding(name.name)) missing.push({name: name.name, line: name.loc.start.line, column: name.loc.start.column + 1});
    },
  });
  return missing;
}

function sourceFiles(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?jsx?$/.test(entry.name) ? [file] : [];
  });
}

test('JSX audit catches missing components and missing member roots', () => {
  const source = 'export const Page = () => <><LocalizedText/><widgets.Card/><_Missing/></>;';
  assert.deepEqual(unboundComponents(source).map(item => item.name), ['LocalizedText', 'widgets', '_Missing']);
});

test('JSX audit respects imported aliases, lexical scope, and member properties', () => {
  const source = `
    import React from 'react';
    import {LocalizedText as Copy} from './i18n.jsx';
    import * as widgets from './widgets.jsx';
    function Page({Button}) {
      const Row = () => <div/>;
      return <React.Fragment><Copy/><Button/><Row/><widgets.Card/><my-widget/></React.Fragment>;
    }
    const Outside = () => <Button/>;
  `;
  assert.deepEqual(unboundComponents(source).map(item => item.name), ['Button']);
});

test('every production JSX component reference has a lexical or imported binding', () => {
  const files = sourceFiles(join(root, 'src'));
  assert.ok(files.some(file => file.endsWith('Onboarding.jsx')));
  const missing = files.flatMap(file => unboundComponents(readFileSync(file, 'utf8')).map(item =>
    `${relative(root, file)}:${item.line}:${item.column} — ${item.name}`));
  assert.deepEqual(missing, [], `Unbound JSX components will fail at render time:\n${missing.join('\n')}`);
});
