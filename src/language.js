import {messages} from './locales.js';
import {displayAt as canonicalDisplayAt} from './maintenance.js';

export const LANGUAGE_KEY = 'jetrise.language';
export const LANGUAGES = ['vi', 'en', 'ja'];
export const isLanguage = value => LANGUAGES.includes(value);
export const intlLocale = language => ({vi: 'vi-VN', en: 'en-US', ja: 'ja-JP'})[language] || 'vi-VN';
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Only system-generated labels/messages are translated inside captures. Names and IDs stay verbatim.
const messageFields = {
  'Đã sơn {0} · {1}.': ['1'],
  'Đã lắp {0} cho {1}.': ['0'],
  'Đã ký hỗ trợ {0} · giảm 8% chi phí cơ sở mỗi vòng, phí ngày tính khi chốt. Cam kết 7 ngày.': ['0'],
  'Đã cập nhật đội {0}.': ['0'],
  'Đã hoàn tất đào tạo {0}.': ['0'],
  'Đã nghiên cứu {0}. Dự báo dùng mức tác động đã xác định trong mô phỏng.': ['0'],
  'Hoàn thành {0} · thưởng {1}.': ['0'],
  'Hoàn tất {0}.': ['0'],
  'Cần hoàn tất {0} trước.': ['0'],
  'Đã hoàn tất nghiên cứu {0}.': ['0'],
  'Đã bắt đầu {0}; có hiệu lực từ ngày {1}.': ['0'],
  'Đã huỷ {0}. Phí đã trả không được hoàn; nghiên cứu hoàn tất trước đó vẫn giữ nguyên.': ['0'],
  'Đã lưu mục tiêu {0} · ngày {1}–{2}. Không thu phí hoặc thưởng tiền.': ['0'],
  'Đã áp dụng định vị {label}.': ['label'],
  'Đã áp dụng định vị {label}; cam kết 7 ngày khai thác, phí duy trì thu mỗi ngày.': ['label'],
  'Đã {0} riêng lượt ngày {1}. Lịch tuần giữ nguyên.': ['0'],
  '{0} · cần sửa chữa đột xuất': ['0'],
  '{0}. Ca kiểm tra tuần không sửa lỗi kỹ thuật.': ['0'],
  'Đã đặt ca bảo dưỡng 5 giờ từ {0}, lặp mỗi tuần. Phí được trừ khi ca bắt đầu; lịch bay được giữ.': ['0'],
  'Ca bảo dưỡng trùng chuyến đã xếp {0}. Chọn khoảng trống hoặc dời chuyến trước.': ['0'],
  'Ca tuần 5 giờ: {0}; phí thu khi ca bắt đầu.': ['0'],
  'Hạn {0}. Chưa có ca hoàn tất đúng hạn trong kế hoạch hiện tại.': ['0'],
  'Hoàn tất {0}. Kiểm tra lịch bay trong thời gian ngừng khai thác.': ['0'],
  'Lịch tuần / chặng đã cam kết cần {0}, đang có {1}; thiếu {2} quyền tại {3}. Chuyến thiếu quyền có thể bị hủy; mua lại còn phụ thuộc công suất và thời gian chờ.': ['3'],
  'Lịch tuần cần {0} lượt, gói cho phép {1} tại {2}. Kiểm tra gói hoặc đổi lịch.': ['2'],
  'Đã bổ sung {0} vòng khứ hồi vào lịch tuần.{1}': ['1'],
  'Bản dự phòng không hợp lệ: {0}': ['0'],
  'Backup trước {0}': ['0'],
  '{0} (hỏng hoặc không khớp)': ['0'],
  'Đã yêu cầu tải gói save · {0} backup chuyển đổi.{1}': ['1'],
  'Không kèm: {0}.': ['0'],
  'Ngày {0}: {1}': ['1'],
  'Chuyển tuyến · giá Y bằng {fare}% giá tham chiếu sau tuần lấp đầy {load}%.{extra}': ['extra'],
  'Giữ tuyến · giá Y bằng {fare}% giá tham chiếu sau tuần lấp đầy {load}%.{extra}': ['extra'],
  'Ngày {day}: {pax} khách · lợi nhuận {profit}. Hoàn tất {research}.': ['research'],
};

// Engine messages remain canonical Vietnamese in saves and worker responses.
// Match their source templates only when presenting them, preserving captured data.
const templates = Object.entries(messages).filter(([key]) => /\{\w+\}/.test(key) && !/\{\w+\}\{\w+\}/.test(key)).map(([key, copy]) => {
  const names = [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  const parts = key.split(/\{\w+\}/g);
  return {key, copy, names, named: /\{[a-zA-Z]/.test(key), specificity: parts.join('').length, pattern: new RegExp('^' + parts.map(escapePattern).join('([\\s\\S]*?)') + '$')};
}).filter(template => template.specificity >= 8).sort((a, b) => b.specificity - a.specificity || Number(b.named) - Number(a.named));

export function initialLanguage(storage, browserLanguage = 'vi') {
  try {
    const stored = storage?.getItem(LANGUAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch { /* Language selection still works when storage is unavailable. */ }
  const language = browserLanguage.toLowerCase().split('-')[0];
  return isLanguage(language) ? language : 'vi';
}

export function saveLanguage(storage, language) {
  if (!isLanguage(language) || !storage) return false;
  try {
    storage.setItem(LANGUAGE_KEY, language);
    return true;
  } catch { return false; }
}

export function translate(language, source, values = {}) {
  if (typeof source !== 'string') return source;
  const key = source.trim();
  if (language !== 'vi') {
    const suffix = /^(.*\.)( Đã trả \d+ quyền mới dư; không hoàn phí mua\.| Đã hoàn \$[\d,.]+ cho \d+ vé bán trước\.)$/s.exec(source);
    if (suffix) return translate(language, suffix[1]) + translate(language, suffix[2]);
  }
  let translated = language === 'vi' ? undefined : messages[key]?.[language];
  if (language !== 'vi' && translated === undefined) {
    const date = /^(Thứ Hai|Thứ Ba|Thứ Tư|Thứ Năm|Thứ Sáu|Thứ Bảy|Chủ Nhật) (\d{2}:\d{2}) · ngày (-?\d+)$/.exec(key);
    if (date) return translate(language, '{weekday} {time} · ngày {day}', {weekday: translate(language, date[1]), time: date[2], day: date[3]});
    if (/^Trước (JET-|điều khoản|điều kiện)/.test(key) && key.includes(': ')) {
      const at = key.indexOf(': ');
      return translate(language, '{label}: {error}', {label: translate(language, key.slice(0, at)), error: translate(language, key.slice(at + 2))});
    }
  }
  if (language !== 'vi' && translated === undefined && !/\{\w+\}/.test(key) && /[À-ỹĐđ]/.test(key)) {
    for (const template of templates) {
      const match = template.pattern.exec(key);
      if (!match) continue;
      translated = template.copy[language];
      const captures = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
      for (const name of messageFields[template.key] || []) {
        const value = captures[name];
        captures[name] = template.key === 'Không kèm: {0}.' ? value.split(', ').map(label => translate(language, label)).join(', ') : translate(language, value);
      }
      if (template.key.startsWith('{airport}: cần {needed} quyền slot vào thứ')) {
        const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
        captures.weekday = translate(language, weekdays[Number(captures.weekday) - 2] || captures.weekday);
      }
      values = {...captures, ...values};
      break;
    }
  }
  const text = translated === undefined ? source : source.slice(0, source.indexOf(key)) + translated + source.slice(source.indexOf(key) + key.length);
  return text.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}

export function formatGameTime(language, at) {
  const source = canonicalDisplayAt(at);
  const match = /^(.*) (\d{2}:\d{2}) · ngày (-?\d+)$/.exec(source);
  if (!match) return source;
  return translate(language, '{weekday} {time} · ngày {day}', {weekday: translate(language, match[1]), time: match[2], day: match[3]});
}

export function translateLedgerLabel(language, source) {
  if (language === 'vi' || typeof source !== 'string' || source.length < 120) return translate(language, source);
  // Older saves truncate ledger descriptions at 120 characters. Never invent the lost tail.
  if (source.endsWith('.') && (messages[source] || templates.some(template => template.specificity >= 20 && template.key.endsWith('.') && template.pattern.test(source)))) return translate(language, source);
  for (let end = source.lastIndexOf('. '); end > 0; end = source.lastIndexOf('. ', end - 1)) {
    const prefix = source.slice(0, end + 1);
    if (messages[prefix] || templates.some(template => template.specificity >= 20 && template.key.endsWith('.') && template.pattern.test(prefix))) {
      return translate(language, prefix) + ' …';
    }
  }
  return translate(language, 'Giao dịch tiền đã ghi nhận · mô tả rút gọn');
}
