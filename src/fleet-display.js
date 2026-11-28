// Aircraft side-view class by cabin size.
export function silhouetteClass(seats) {
  return seats >= 500 ? 'super' : seats >= 240 ? 'wide' : seats >= 140 ? 'narrow' : 'regional';
}
