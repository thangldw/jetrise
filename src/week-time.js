export const WEEK=168;
export function weeklyOverlap(start,hours,other,otherHours){return [-WEEK,0,WEEK].some(offset=>start<other+offset+otherHours&&start+hours>other+offset);}
// Retain the original slot for editing continuation segments.
export function flightSegments(slots,durationOf){return slots.flatMap(slot=>[-WEEK,0].map(offset=>({ ...slot,slot,start:slot.start+offset,end:slot.start+offset+durationOf(slot)})).filter(x=>x.start<WEEK&&x.end>0));}
