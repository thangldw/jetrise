// Existing synthetic AI lease terms, shared by legacy growth and JET-206.
export const RIVAL_LEASE=Object.freeze({deposit:500000,rent:10000,term:14});
// AI difficulty, chosen once when competition is enabled. Saves without a level play as 'normal'.
// review: days between fare reviews. react: rivals also price against the player's Y fare in the same market.
export const AI_LEVELS=Object.freeze({
 easy:Object.freeze({cash:3000000,reliability:.88,review:7,step:[.03,-.05],react:false,hour:6}),
 normal:Object.freeze({cash:5000000,reliability:.92,review:7,step:[.05,-.08],react:false,hour:6}),
 hard:Object.freeze({cash:8000000,reliability:.95,review:1,step:[.03,-.05],react:true,hour:8})
});
export const aiLevel=strategy=>AI_LEVELS[strategy?.difficulty||'normal'];
