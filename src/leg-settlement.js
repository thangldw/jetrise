// Shared dated recognition boundary for player and rival manifests (integer cents).
export function legSettlement(leg,start,end){
 const departing=leg.departure>=start&&leg.departure<end,arriving=leg.arrival>=start&&leg.arrival<end;
 return {departing,arriving,revenue:arriving?leg.ticketCents+(leg.serviceCents||0):0,nonfuel:departing?leg.nonfuelCents:0,fuel:departing?leg.fuelCents:0,co2:departing?leg.co2Cents:0};
}
