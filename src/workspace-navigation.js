// UI destinations are ephemeral; career data and domain transitions stay unchanged.
export const WORKSPACE_DEFAULTS={home:'overview',fleet:'overview',network:'map',schedule:'company',strategy:'competition'};
export function workspaceDestination(type,extra={}){
 const targets={hq:['home',extra.section||'hubs'],routes:['network',extra.section||'manage'],planner:['schedule','company'],gameplay:['strategy',extra.section||'competition'],'fleet-studio':['fleet',extra.tab||'details'],market:['fleet','market']};
 const target=targets[type];return target?{page:target[0],section:target[1],plane:extra.plane}:null;
}
