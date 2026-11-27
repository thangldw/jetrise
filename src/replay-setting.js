// Whether the day replay plays after a day is run. Like guided mode, the preference lives beside the language
// setting and never in the career, so it cannot affect the save format.
import {useSyncExternalStore} from 'react';

export const REPLAY_KEY = 'jetrise.replay';
const CHANGED = 'jetrise:replay';

/** @param {{getItem(key: string): string | null}} storage */
export function replayEnabled(storage) {
  try {
    return storage.getItem(REPLAY_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** @param {{setItem(key: string, value: string): void}} storage @param {boolean} on */
export function setReplay(storage, on) {
  try {
    storage.setItem(REPLAY_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice only lasts for this page load.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
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

export const useReplay = () => useSyncExternalStore(subscribe, () => replayEnabled(window.localStorage), () => true);
