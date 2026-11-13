import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('fresh onboarding and both founding stages render in VI, EN, and JA without changing the save', {timeout: 30000}, async t => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cacheDir = mkdtempSync(join(tmpdir(), 'jetrise-founding-render-'));
  const savedGlobals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let language = 'vi';
  let server;
  try {
    server = await createServer({
      root,
      // Keep SSR independent of dev-server warmup and concurrent build caches.
      configFile: false,
      cacheDir,
      appType: 'custom',
      logLevel: 'error',
      esbuild: {jsx: 'automatic'},
      optimizeDeps: {noDiscovery: true, include: [], entries: []},
      ssr: {external: ['react', 'react-dom', '@phosphor-icons/react']},
      server: {middlewareMode: true, watch: null, hmr: false, ws: false},
    });
    const {I18nProvider} = await server.ssrLoadModule('/src/i18n.jsx');
    const {LANGUAGE_KEY, translate} = await server.ssrLoadModule('/src/language.js');
    const {createGame, transition} = await server.ssrLoadModule('/src/game.js');
    const {Onboarding} = await server.ssrLoadModule('/src/Onboarding.jsx');
    const {LaunchOffice} = await server.ssrLoadModule('/src/LaunchOffice.jsx');
    const noAction = () => { throw Error('Rendering must not dispatch game or storage actions'); };
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: {
      localStorage: {getItem: key => key === LANGUAGE_KEY ? language : null, setItem: noAction},
    }});
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {language: 'en-US'}});
    function Button({children, icon, primary, ...props}) {
      return React.createElement('button', props, children);
    }
    const fresh = createGame();
    const setup = transition(fresh, {type: 'setup', name: 'Render Air', origin: 'HAN', logo: 'wing', color: '#123abc', models: ['A320', 'B738']});
    assert.ok(!setup.error, setup.error);
    const next = transition(setup.game, {type: 'founding-next'});
    assert.ok(!next.error, next.error);
    const scenarios = [
      {name: 'fresh onboarding', Component: Onboarding, game: fresh, heading: 'Lập hãng bay của bạn', marker: 'name="airline-name"', h1: '<h1>'},
      {name: 'initial fleet', Component: LaunchOffice, game: setup.game, heading: 'Đội bay đầu tiên đã sẵn sàng.', marker: 'class="launch-fleet"', h1: '<h1 tabindex="-1">'},
      {name: 'first routes', Component: LaunchOffice, game: next.game, heading: 'Đường bay đầu tiên do bạn chọn.', marker: 'class="management-card launch-route"', h1: '<h1 tabindex="-1">'},
    ];
    for (const locale of ['vi', 'en', 'ja']) {
      language = locale;
      for (const scenario of scenarios) {
        await t.test(`${scenario.name}: ${locale}`, () => {
          const before = JSON.stringify(scenario.game);
          const props = {game: scenario.game, Button, onStart: noAction, onSaves: noAction, open: noAction, submit: noAction, onFinish: noAction};
          const markup = renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(scenario.Component, props)));
          assert.ok(markup.includes(scenario.marker), `${scenario.name} must render its main task content`);
          assert.ok(markup.includes(`${scenario.h1}${translate(locale, scenario.heading)}</h1>`));
          assert.match(markup, new RegExp(`<option value="${locale}" lang="${locale}" selected="">`));
          assert.doesNotMatch(markup, /\{\w+\}/, 'LocalizedText must interpolate its values');
          assert.equal(JSON.stringify(scenario.game), before, 'rendering must not mutate the save');
        });
      }
    }
  } finally {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    try {
      if (server) await server.close();
    } finally {
      rmSync(cacheDir, {recursive: true, force: true});
    }
  }
});
