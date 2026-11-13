import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Globe} from '@phosphor-icons/react';
import {formatGameTime, initialLanguage, intlLocale, isLanguage, saveLanguage, translate, translateLedgerLabel} from './language.js';
import * as airportDisplay from './airport-display.js';

function localeTools(language) {
  const locale = intlLocale(language), regions = new Intl.DisplayNames([language], {type: 'region'});
  return {
    language, locale, t: (source, values) => translate(language, source, values),
    displayAt: at => formatGameTime(language, at), ledgerLabel: source => translateLedgerLabel(language, source),
    countryName: code => regions.of(code), number: value => Math.round(value).toLocaleString(locale),
    airportLabel: (game, code) => airportDisplay.airportLabel(game, code, language),
    routeLabel: (game, route) => airportDisplay.routeLabel(game, route, language),
    airportName: (game, code) => airportDisplay.airportName(game, code, language),
    cityName: (game, code) => airportDisplay.cityName(game, code, language),
    airportSearchText: airportDisplay.airportSearchText,
    airportMessage: (game, source) => airportDisplay.airportMessage(game, source, language),
  };
}
const fallback = {...localeTools('vi'), setLanguage: () => {}};
const I18nContext = createContext(fallback);
function browserStorage() {
  try { return window.localStorage; } catch { return undefined; }
}

export function I18nProvider({children}) {
  const [language, updateLanguage] = useState(() => initialLanguage(browserStorage(), navigator.language));
  const setLanguage = useCallback(value => { if (isLanguage(value)) updateLanguage(value); }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    saveLanguage(browserStorage(), language);
  }, [language]);
  const value = useMemo(() => ({...localeTools(language), setLanguage}), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

export function LanguageSelect() {
  const {language, setLanguage} = useI18n();
  return <label className="language-select">
    <Globe size={18} aria-hidden="true"/>
    <select aria-label="Language / Ngôn ngữ / 言語" value={language} onChange={event => setLanguage(event.target.value)}>
      <option value="vi" lang="vi">VI</option>
      <option value="en" lang="en">EN</option>
      <option value="ja" lang="ja">JA</option>
    </select>
  </label>;
}

// Keep emphasized values as React nodes while translators control sentence order.
export function LocalizedText({source, values = {}}) {
  const {t} = useI18n();
  return t(source).split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <React.Fragment key={index}>{name && Object.hasOwn(values, name) ? values[name] : part}</React.Fragment>;
  });
}
