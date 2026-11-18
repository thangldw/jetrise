import React from "react";
import {useI18n} from "./i18n.jsx";
import {weatherKind, WEATHER_EFFECT} from "./gameplay.js";
import {weatherOutlookDays} from "./research.js";

const LABEL = {clear: "Quang đãng", fog: "Sương mù", storm: "Bão"};

// Airports the player actually serves: the home hub plus both ends of every opened route.
export const servedAirports = (game, routes) => {
  const codes = new Set([game.airline.origin]);
  for (const index of game.openedRoutes) {
    const route = routes[index];
    if (route) {
      codes.add(route.from);
      codes.add(route.to);
    }
  }
  return [...codes].slice(0, 14);
};

export function WeatherOutlook({game, routes}) {
  const {t: tx} = useI18n();
  const airports = servedAirports(game, routes);
  const days = Array.from({length: weatherOutlookDays(game)}, (_, i) => game.day + i);
  return (
    <section className="management-card weather-outlook" aria-labelledby="weather-title">
      <h3 id="weather-title">{tx("Thời tiết sân bay")}</h3>
      <p className="micro">{tx("Sương mù giảm 15% và bão giảm 45% nhu cầu của mọi tuyến chạm sân bay đó trong ngày.")}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">{tx("Sân bay")}</th>
            {days.map(day => <th scope="col" key={day}>{tx("Ngày {0}", {0: day})}</th>)}
          </tr>
        </thead>
        <tbody>
          {airports.map(code => (
            <tr key={code}>
              <th scope="row">{code}</th>
              {days.map(day => {
                const kind = weatherKind(code, day);
                return <td key={day} className={"weather-" + kind}>{tx(LABEL[kind])}{kind !== "clear" ? ` ${Math.round((WEATHER_EFFECT[kind] - 1) * 100)}%` : ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
