// Guided mode: new players see a short list of Headquarters tabs and the rest unlock as the career ages.
// The preference lives next to the language setting, not in the career, so it never touches the save format.
import {useSyncExternalStore} from 'react';

export const GUIDED_KEY = 'jetrise.guided';
const CHANGED = 'jetrise:guided';

// First day on which each Headquarters tab appears while guided mode is on. Unlisted tabs are always visible.
/** @type {Record<string, number>} */
export const HQ_UNLOCK_DAY = {services: 4, weekly: 4, decisions: 8, development: 8};

/** @param {{getItem(key: string): string | null}} storage */
export function guidedEnabled(storage) {
  try {
    return storage.getItem(GUIDED_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** @param {{setItem(key: string, value: string): void}} storage @param {boolean} on */
export function setGuided(storage, on) {
  try {
    storage.setItem(GUIDED_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice only lasts for this page load.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
}

// Keeps the tab the player is currently on, so a deep link never leaves them on a hidden tab.
/** @param {Array<[string, string]>} tabs @param {{day: number, enabled: boolean, current?: string}} options */
export function visibleTabs(tabs, {day, enabled, current}) {
  if (!enabled) return tabs;
  return tabs.filter(([key]) => key === current || day >= (HQ_UNLOCK_DAY[key] ?? 1));
}

/** @param {Array<[string, string]>} tabs @param {number} day */
export function nextUnlock(tabs, day) {
  const later = tabs.map(([key]) => HQ_UNLOCK_DAY[key] ?? 1).filter(d => d > day);
  return later.length ? Math.min(...later) : null;
}

/** @param {() => void} callback */
const subscribe = callback => {
  window.addEventListener(CHANGED, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGED, callback);
    window.removeEventListener('storage', callback);
  };
};

export const useGuided = () => useSyncExternalStore(subscribe, () => guidedEnabled(window.localStorage), () => true);
