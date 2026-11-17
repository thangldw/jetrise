import React, {useState} from "react";
import {useI18n} from "./i18n.jsx";

export const VOLUME_KEY = "jetrise.volume";

const readVolume = () => {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(value) && value >= 0 && value <= 1 && window.localStorage.getItem(VOLUME_KEY) !== null ? value : 0.45;
  } catch {
    return 0.45;
  }
};

export function VolumeControl() {
  const {t: tx} = useI18n();
  const [volume, setVolume] = useState(readVolume);
  const change = event => {
    const next = Number(event.target.value) / 100;
    setVolume(next);
    window.jetriseAudio?.setVolume(next);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(next));
    } catch {
      // Volume still applies for this page load.
    }
  };
  return (
    <div className="setting-row">
      <div>
        <b>{tx("Âm lượng")}</b>
        <p>{tx("Điều chỉnh mức âm nền và hiệu ứng.")}</p>
      </div>
      <input type="range" min="0" max="100" step="5" value={Math.round(volume * 100)} onChange={change} aria-label={tx("Âm lượng")} />
    </div>
  );
}
