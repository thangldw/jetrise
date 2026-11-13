import {projectedWeekReports} from './planner.js';
import {positioningDaily} from './positioning.js';
import {researchBlock, startResearch} from './research.js';

// Same seven-day flight model as the planner; common company overhead is excluded from both sides.
function contribution(ctx, state) {
  const days = projectedWeekReports(ctx, state, false);
  return days.reduce((sum, {report}) => ({profit: sum.profit + report.profit - positioningDaily(ctx),
    pax: sum.pax + report.pax, burn: sum.burn + report.burn}), {profit: 0, pax: 0, burn: 0});
}
export function previewDevelopment(ctx, state, action) {
  const draft = structuredClone({...ctx, tycoon: state});
  if (action.type === 'positioning') {
    if (action.key === 'none') delete draft.hq.positioning;
    else draft.hq.positioning = {key: action.key, startedDay: ctx.day};
  } else if (action.type === 'research') {
    if (researchBlock(draft, action.key)) return null;
    startResearch(draft, action.key);
  } else throw Error('Unknown development preview');
  const before = contribution(ctx, state), after = contribution(draft, draft.tycoon);
  return {before, after, delta: after.profit - before.profit};
}
