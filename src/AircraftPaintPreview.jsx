import {useI18n} from './i18n.jsx';
import React,{useId} from 'react';
import {liveryStyle,nameInk} from './liveries.js';
import {LiveryPattern} from './LiveryPattern.jsx';
import {AirlineMark} from './AirlineMark.jsx';

const AIRCRAFT=import.meta.env.BASE_URL+'assets/aircraft-premium-v1.png';
// Generated neutral studio render; editable overlays retain the player's identity.
// The airline name sits in the white band between the fuselage top edge and the window row, between the wing root and the door behind the cockpit.
const NAME_X=593,NAME_MAX=205;
export function AircraftPaintPreview({name,logo,color,registration,variant=0}){
 const {t:tx,locale}=useI18n();
 const label=name.trim()||tx('YOUR AIRLINE'),theme=liveryStyle(variant,color),id=useId().replaceAll(':',''),tail='M52 37L91 37Q151 115 228 162L99 165Z',body='M160 167Q285 142 451 148L850 145Q925 145 958 194Q974 213 952 226Q599 253 232 240L156 223Z';
 return <div className="aircraft-paint-preview premium-aircraft"><div className="aircraft-studio-topline" aria-hidden="true"><span>{tx("DESIGN STUDIO")}</span><span>{registration}</span></div><svg viewBox="0 0 1000 355" role="img" aria-label={tx("Xem trước sơn và logo {0} trên máy bay phản lực",{0:name.trim()||tx('hãng của bạn')})}><defs><mask id={id+'alpha'} style={{maskType:'alpha'}}><image href={AIRCRAFT} x="20" y="5" width="960" height="320"/></mask><clipPath id={id+'tail'}><path d={tail}/></clipPath><clipPath id={id+'body'}><path d={body}/></clipPath><radialGradient id={id+'spot'}><stop stopColor="#54788f" stopOpacity=".32"/><stop offset="1" stopColor="#17314a" stopOpacity="0"/></radialGradient></defs>
 <ellipse cx="515" cy="205" rx="450" ry="145" fill={`url(#${id}spot)`}/><ellipse cx="530" cy="301" rx="350" ry="5" fill="#020b17" opacity=".6"/>
 <image href={AIRCRAFT} x="20" y="5" width="960" height="320"/>
 <g mask={`url(#${id}alpha)`}><path d={tail} fill={color} style={{mixBlendMode:'multiply'}}/><g clipPath={`url(#${id}tail)`}><g transform="translate(-60 8) scale(1.25)"><LiveryPattern pattern={theme.pattern} accent={theme.accent} tail/></g></g><g clipPath={`url(#${id}body)`} style={{mixBlendMode:'multiply'}}><path d="M150 221Q540 244 975 213L975 238Q540 269 150 241Z" fill={color}/><g transform="translate(30 48)"><LiveryPattern pattern={theme.pattern} accent={theme.accent}/></g></g></g>
 <image href={AIRCRAFT} x="20" y="5" width="960" height="320" style={{mixBlendMode:'multiply'}}/>
 <g transform="translate(112 105)" color="white"><AirlineMark logo={logo} size={32}/></g><text x={NAME_X} y="172" textAnchor="middle" fill={nameInk(color)} fontSize="15" fontWeight="700" textLength={label.length*9>NAME_MAX?NAME_MAX:undefined} lengthAdjust="spacingAndGlyphs" style={{mixBlendMode:'multiply'}}>{label}</text><text x="256" y="219" fontSize="8" fill="#3e5268" letterSpacing="1">{registration}</text>
 </svg><p>{tx("Studio phối màu · hình máy bay minh họa, không đại diện mẫu đang chọn")}</p></div>;
}
