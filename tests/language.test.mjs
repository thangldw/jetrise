import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGE_KEY, initialLanguage, saveLanguage, translate, intlLocale} from '../src/language.js';
import {messages} from '../src/locales.js';

const memoryStorage = initial => {
  const values = new Map(Object.entries(initial));
  return {values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
};

test('language preference wins over browser language and supports regional tags', () => {
  assert.equal(initialLanguage(memoryStorage({[LANGUAGE_KEY]: 'ja'}), 'en-US'), 'ja');
  assert.equal(initialLanguage(memoryStorage({[LANGUAGE_KEY]: 'unknown'}), 'en-GB'), 'en');
  assert.equal(initialLanguage(undefined, 'ja-JP'), 'ja');
  assert.equal(initialLanguage(undefined, 'fr-FR'), 'vi');
  assert.equal(intlLocale('ja'), 'ja-JP');
});

test('language storage never reads or writes career, backup or migration keys', () => {
  const storage = memoryStorage({'vantis-living-world-v1': '{"schema":1,"day":37}', 'career-backup': 'unchanged'});
  const before = new Map(storage.values);
  for (const language of ['en', 'ja', 'vi']) {
    assert.equal(saveLanguage(storage, language), true);
    assert.equal(initialLanguage(storage, 'en-US'), language);
    for (const [key, value] of before) assert.equal(storage.values.get(key), value);
  }
  assert.deepEqual([...storage.values.keys()], [...before.keys(), LANGUAGE_KEY]);
  assert.equal(saveLanguage(storage, 'unsupported'), false);
  assert.equal(storage.values.get(LANGUAGE_KEY), 'vi');
});

test('blocked or full storage leaves language selection usable', () => {
  const blocked = {getItem() { throw Error('SecurityError'); }, setItem() { throw Error('QuotaExceededError'); }};
  assert.equal(initialLanguage(blocked, 'ja-JP'), 'ja');
  assert.equal(saveLanguage(blocked, 'en'), false);
  assert.equal(saveLanguage(undefined, 'en'), false);
});

test('catalog retains the same interpolation values in each language', () => {
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  assert.ok(Object.keys(messages).length > 2900);
  for (const [source, copy] of Object.entries(messages)) {
    for (const language of ['en', 'ja']) {
      assert.ok(copy[language]?.trim(), `${language}: ${source}`);
      assert.deepEqual(placeholders(copy[language]), placeholders(source), `${language}: ${source}`);
    }
  }
});

test('translation preserves player-provided values and JSX spacing', () => {
  assert.equal(translate('en', 'Đội bay'), 'Fleet');
  assert.equal(translate('ja', 'Đội bay'), '機材');
  assert.equal(translate('en', ' Đội bay '), ' Fleet ');
  const name = 'Trụ sở <airline> $500 {unknown}';
  const source = 'Thành lập {name} · nhận $500 triệu';
  assert.equal(translate('en', source, {name}), `Found ${name} · receive $500 million`);
  assert.equal(translate('vi', source, {name}), `Thành lập ${name} · nhận $500 triệu`);
  assert.equal(translate('ja', 'An unknown airline name'), 'An unknown airline name');
  assert.equal(translate('en', 'Hà Nội đến Tokyo'), 'Hà Nội đến Tokyo');
  assert.equal(translate('ja', 'Hà Nội đến Tokyo'), 'Hà Nội đến Tokyo');
  assert.equal(translate('en', 123), 123);
});

test('canonical engine messages translate without changing numerical evidence', () => {
  const source = 'Chọn màu {0}';
  for (const language of ['en', 'ja']) {
    assert.equal(translate(language, 'Chọn màu #123abc'), translate(language, source, {0: '#123abc'}));
  }
});

test('system message arguments are localized while aircraft and player names stay verbatim', () => {
  const name = 'Hà Nội đến Tokyo';
  for (const language of ['en', 'ja']) {
    const source = `Đã lắp Wi-Fi cho ${name}.`;
    assert.ok(translate(language, source).includes(name));
    assert.ok(!translate(language, 'Đã cập nhật đội Phi công.').includes('Phi công'));
    const founded = `Đã thành lập ${name} · cấp $500.000.000 và 2 máy bay tầm trung. Chuẩn bị đội bay trước khi chọn tuyến.`;
    assert.ok(translate(language, founded).includes(name));
  }
});

test('canonical dates and arithmetic results have unambiguous presentation', () => {
  assert.equal(translate('ja', 'Cam kết hiện tại đến ngày 8.'), '現在の最低契約期間は8日目までです。');
  assert.equal(translate('ja', 'Đã đặt Airbus A320neo. Giao đầu ngày 3.'), 'Airbus A320neoを発注しました。3日目の開始時に納入されます。');
  const shift = 'Đã đặt ca bảo dưỡng 5 giờ từ Thứ Ba 08:00 · ngày 2, lặp mỗi tuần. Phí được trừ khi ca bắt đầu; lịch bay được giữ.';
  assert.ok(translate('en', shift).includes('Tuesday 08:00 · day 2'));
  assert.ok(translate('ja', shift).includes('2日目（火曜日）08:00'));
  const slots = 'HAN: cần 3 quyền slot vào thứ 8, 14:00; đang có 1. Mua quyền theo giờ trong Thiết kế mạng trước khi sửa lịch hoặc cứu chuyến.';
  assert.ok(translate('en', slots).includes('Sunday at 14:00'));
  assert.ok(translate('ja', slots).includes('日曜日14:00'));
});

test('all maintenance alert titles translate without treating aircraft identifiers as language', () => {
  for (const state of ['đã đến hạn bảo dưỡng', 'hạn bảo dưỡng trong 72 giờ', 'đang bảo dưỡng', 'đã đặt bảo dưỡng']) {
    for (const language of ['en', 'ja']) {
      const translated = translate(language, `VN-001 · ${state}`);
      assert.ok(translated.startsWith('VN-001'));
      assert.ok(!/[ĐđĂăƠơƯư\u1ea0-\u1ef9]/.test(translated), translated);
    }
  }
});

test('combined operation acknowledgements translate every suffix without losing amounts', () => {
  const base = 'Đã điều chỉnh chuyến trong lịch tuần.';
  const released = ' Đã trả 2 quyền mới dư; không hoàn phí mua.';
  const refunded = ' Đã hoàn $1,200.00 cho 4 vé bán trước.';
  for (const language of ['en', 'ja']) {
    for (const suffix of [released, refunded, released + refunded]) {
      assert.equal(translate(language, base + suffix), translate(language, base) + translate(language, suffix));
      assert.ok(!/[ĐđĂăƠơƯư\u1ea0-\u1ef9]/.test(translate(language, base + suffix)));
    }
    assert.ok(translate(language, base + refunded).includes('$1,200.00'));
    assert.equal(translate(language, base + released + refunded), translate(language, base) + translate(language, released) + translate(language, refunded));
  }
});

test('shortened historical ledger labels show only recoverable meaning', async () => {
  const {translateLedgerLabel} = await import('../src/language.js');
  const source = 'Đã điều chuyển VN-0001 sang SGN và gỡ lịch bay, ca bảo dưỡng lặp cũ. Đã trả 2 quyền mới dư; không hoàn phí mua. Đã hoàn ';
  assert.equal(source.length, 120);
  for (const language of ['en', 'ja']) {
    const result = translateLedgerLabel(language, source);
    assert.ok(result.endsWith(' …'));
    assert.ok(result.includes('VN-0001'));
    assert.ok(!/[ĐđĂăƠơƯư\u1ea0-\u1ef9]/.test(result), result);
  }
  assert.equal(translateLedgerLabel('vi', source), source);
});

test('Vietnamese labels without diacritics are not mistaken for language-neutral data', () => {
  assert.equal(translate('en', 'Doanh thu'), 'Revenue');
  assert.equal(translate('ja', 'Doanh thu'), '売上');
  assert.equal(translate('en', 'Xem'), 'View');
  assert.equal(translate('ja', 'Xem'), '表示');
});
