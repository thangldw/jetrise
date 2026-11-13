import React from 'react';
import {LocalizedText} from './i18n.jsx';

export function AirportDataCredit() {
  return <p className="micro airport-data-credit"><LocalizedText
    source="Tên địa điểm được biên tập từ {0} ({1}); dữ liệu sân bay từ {2} (public domain)."
    values={{
      0: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>,
      1: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>,
      2: <a href="https://ourairports.com/data/" target="_blank" rel="noopener noreferrer">OurAirports</a>,
    }}
  /></p>;
}
