import React from 'react';
import {AirplaneTilt,NavigationArrow,SunHorizon,Wind,Compass,PaperPlaneTilt,GlobeHemisphereWest,Mountains,StarFour,Bird,Planet,Lightning,Feather,RocketLaunch,Waves,Infinity} from '@phosphor-icons/react';
const MARKS={wing:AirplaneTilt,compass:NavigationArrow,horizon:SunHorizon,wind:Wind,rose:Compass,paper:PaperPlaneTilt,globe:GlobeHemisphereWest,mountain:Mountains,star:StarFour,bird:Bird,planet:Planet,lightning:Lightning,feather:Feather,rocket:RocketLaunch,waves:Waves,infinity:Infinity};
export function AirlineMark({logo='wing',size=40}){const Icon=MARKS[logo]||AirplaneTilt;return <Icon size={size} weight="fill" aria-hidden="true"/>;}
