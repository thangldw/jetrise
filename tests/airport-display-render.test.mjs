import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));

test('airport picker and map render localized labels with stable IATA values and custom names', {timeout: 30000}, async t => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cacheDir = mkdtempSync(join(tmpdir(), 'jetrise-airport-render-'));
  const globals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let language = 'vi', server;
  const noAction = () => { throw Error('Rendering must not write or dispatch actions'); };
  try {
    server = await createServer({
      root, configFile: false, cacheDir, appType: 'custom', logLevel: 'error',
      esbuild: {jsx: 'automatic'},
      optimizeDeps: {noDiscovery: true, include: [], entries: []},
      ssr: {external: ['react', 'react-dom', '@phosphor-icons/react']},
      server: {middlewareMode: true, watch: null, hmr: false, ws: false},
    });
    const {I18nProvider} = await server.ssrLoadModule('/src/i18n.jsx');
    const {LANGUAGE_KEY} = await server.ssrLoadModule('/src/language.js');
    const {airportLabel} = await server.ssrLoadModule('/src/airport-display.js');
    const {AirportPicker} = await server.ssrLoadModule('/src/AirportPicker.jsx');
    const {GeoNetwork} = await server.ssrLoadModule('/src/GeoNetwork.jsx');
    const {createGame, transition, routesFor} = await server.ssrLoadModule('/src/game.js');
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: {
      localStorage: {getItem: key => key === LANGUAGE_KEY ? language : null, setItem: noAction},
    }});
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {language: 'en-US'}});
    const added = transition(createGame(), {type: 'airport-add', iata: 'ZZQ', name: 'Nội Bài (HAN) <custom>', city: 'Hà Nội đến Tokyo', country: 'VN', lat: 12, lon: 108});
    assert.ok(!added.error, added.error);
    const game = added.game;
    game.airline.name = 'Nội Bài (HAN)';
    const before = JSON.stringify(game), routes = routesFor(game);
    const render = element => renderToStaticMarkup(React.createElement(I18nProvider, null, element));
    for (const locale of ['vi', 'en', 'ja']) {
      language = locale;
      await t.test(`selected labels and canonical option values: ${locale}`, () => {
        const markup = render(React.createElement(AirportPicker, {game, value: 'HAN', onChange: noAction, id: 'airport-test', initialCountry: 'VN'}));
        const label = escapeHTML(airportLabel(game, 'HAN', locale));
        const input = markup.match(/<input[^>]*id="airport-test-search"[^>]*>/)?.[0];
        assert.ok(input?.includes('role="combobox"') && input.includes(`value="${label}"`), 'the combobox input shows the selected airport label');
        assert.ok(markup.includes(`<li id="airport-test-list-`) && new RegExp(`role="option" data-code="HAN" aria-selected="true"[^>]*>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(markup), markup);
        assert.doesNotMatch(markup, /\{\w+\}/);
        assert.equal(JSON.stringify(game), before);
      });
      await t.test(`custom selected airport is verbatim: ${locale}`, () => {
        const markup = render(React.createElement(AirportPicker, {game, value: 'ZZQ', onChange: noAction, id: 'custom-test', initialCountry: 'JP'}));
        assert.ok(markup.includes('value="Hà Nội đến Tokyo · Nội Bài (HAN) &lt;custom&gt; (ZZQ)"'), 'custom airport text is shown verbatim and escaped');
        assert.ok(markup.includes('role="option" data-code="ZZQ" aria-selected="true"'), 'the custom airport keeps its canonical code');
        assert.equal(JSON.stringify(game), before);
      });
      await t.test(`network title and marker labels: ${locale}`, () => {
        const markup = render(React.createElement(GeoNetwork, {game, routes, route: 0, setRoute: noAction}));
        assert.ok(markup.includes(escapeHTML(airportLabel(game, 'HAN', locale))), 'hub label follows the selected display language');
        assert.ok(markup.includes('Nội Bài (HAN)'), 'the player airline name is not airport-localized');
        assert.equal(JSON.stringify(game), before);
      });
    }
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    try { if (server) await server.close(); }
    finally { rmSync(cacheDir, {recursive: true, force: true}); }
  }
});
