import React from 'react';
import {Flower,FlowerLotus,Snowflake,StarFour} from '@phosphor-icons/react';
export function LiveryPattern({pattern,accent,tail=false}){
 const x=tail?110:70,y=tail?30:130,w=tail?120:820,h=tail?115:60;
 if(pattern==='brand')return null;
 if(pattern==='festival')return <g stroke={accent} strokeWidth={tail?10:8}>{[0,1,2].map(i=><path key={i} d={`M${x+i*w/3} ${y+h}l${w/4} -${h}`}/>)}</g>;
 if(pattern==='aurora'||pattern==='waves')return <g fill="none" stroke={accent}>{[0,1,2].map(i=><path key={i} strokeWidth={tail?6:7-i} opacity={1-i*.18} d={`M${x-15} ${y+h-8-i*10}Q${x+w*.4} ${y-i*4} ${x+w+25} ${y+h-5-i*8}`}/>)}</g>;
 if(pattern==='retro')return <g stroke={accent}>{[0,1,2].map(i=><path key={i} strokeWidth={tail?5:3} d={`M${x} ${y+h*.45+i*8}h${w}`}/>)}</g>;
 if(pattern==='sunrise')return <g fill={accent}><circle cx={x+w*.65} cy={y+h*.8} r={tail?32:32}/>{[0,1,2].map(i=><rect key={i} x={x} y={y+h*.65+i*8} width={w} height="3"/>)}</g>;
 if(pattern==='carbon')return <g stroke={accent} strokeWidth={tail?1.3:1} opacity=".65">{Array.from({length:tail?9:30},(_,i)=><path key={i} d={`M${x+i*(tail?15:30)} ${y}l-${h} ${h}m0 -${h}l${h} ${h}`}/>)}</g>;
 if(pattern==='bamboo')return <g stroke={accent} fill={accent} strokeWidth="3">{[.2,.5,.8].map((n,i)=><g key={i}><path d={`M${x+w*n} ${y+h}l10 -${h}m-9 ${h*.7}h12m-10 -${h*.35}h12`}/><ellipse cx={x+w*n+15} cy={y+h*.45} rx={tail?12:26} ry="4" transform={`rotate(-25 ${x+w*n+15} ${y+h*.45})`}/></g>)}</g>;
 if(pattern==='sakura'||pattern==='snow'||pattern==='stars'||pattern==='lotus'){const Icon={sakura:Flower,snow:Snowflake,stars:StarFour,lotus:FlowerLotus}[pattern];return <g color={accent}>{(tail?[{x:163,y:108,s:28}]:[{x:200,y:163,s:29},{x:585,y:151,s:31},{x:667,y:172,s:20},{x:720,y:141,s:25}]).map((p,i)=><g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i*19})`}><Icon size={p.s} weight="fill"/></g>)}</g>;}
 if(pattern==='silver'||pattern==='prism')return <g fill={accent}>{[0,1,2].map(i=><path key={i} opacity={1-i*.2} d={`M${x+w*i/3} ${y+h}l${w/3} -${h}v${h}Z`}/>)}</g>;
 if(pattern==='horizon')return <g fill="none" stroke={accent} strokeWidth="4"><path d={`M${x} ${y+h*.7}h${w}m-${w} 9h${w}`}/><path d={`M${x+w*.4} ${y+h*.7}l${w*.2} -${h*.35}l${w*.2} ${h*.35}`}/></g>;
 if(pattern==='confetti')return <g>{Array.from({length:tail?10:25},(_,i)=><rect key={i} x={x+(i*37)%w} y={y+(i*17)%h} width={tail?7:11} height={tail?3:5} rx="1" fill={i%3===0?'#8FD8E2':i%3===1?accent:'#F3D5EB'} transform={`rotate(${i*31} ${x+(i*37)%w} ${y+(i*17)%h})`}/>)}</g>;
 return null;
}
