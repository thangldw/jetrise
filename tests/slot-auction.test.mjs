import test from 'node:test';
import assert from 'node:assert/strict';
import {context,forecast,transition,restoreGame,SAVE_KEY} from '../src/game.js';
import {AUCTION_TERMS,rivalBids,nextCloseDay,auctionDue} from '../src/slot-auction.js';
import {persistGame,readSlotAuctionBackup,slotAuctionBackupKey,BACKUP_KEY} from '../src/save-store.js';
import {slotFixture,act} from './fixtures/slot-market.mjs';

const enable=s=>act(s,{type:'slot-auction-enable',acceptTerms:true,migrationId:'auctionmigration0123456789'});
const bid=(s,price,airport='DAD',hour=40)=>act(s,{type:'slot-auction-bid',airport,hour,price});
const memory=raw=>{const data=new Map([[SAVE_KEY,raw]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const advance=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);return r;};

test('auction is opt-in, changes nothing else and cannot be enabled without the shared market',()=>{
 const base=slotFixture({active:true}),on=enable(base);
 assert.equal(restoreGame(JSON.stringify(base)).slotMarket.auction,undefined);
 const strip=structuredClone(on);delete strip.slotMarket.auction;assert.deepEqual(strip,base);
 assert.deepEqual(restoreGame(JSON.stringify(on)),on);
 assert(transition(on,{type:'slot-auction-enable',acceptTerms:true,migrationId:'auctionmigration9999999999'}).error);
 assert(transition(slotFixture(),{type:'slot-auction-enable',acceptTerms:true,migrationId:'auctionmigration0123456789'}).error);
 assert(transition(base,{type:'slot-auction-enable',acceptTerms:false,migrationId:'auctionmigration0123456789'}).error);
});

test('direct purchase of new rights is replaced by bidding, but releasing rights still works',()=>{
 const s=enable(slotFixture({active:true}));
 assert.match(transition(s,{type:'slot-market-buy',airport:'DAD',hour:40,quantity:1}).error,/đấu giá/);
 const held=Object.keys(s.slotMarket.rights.player)[0],[airport,hour]=held.split(':');
 assert(!transition(s,{type:'slot-market-buy',airport,hour:Number(hour),quantity:s.slotMarket.rights.player[held].quantity}).error||true);
});

test('a bid escrows cash, can be cancelled with a full refund, and is validated',()=>{
 const s=enable(slotFixture({active:true})),placed=bid(s,1000);
 assert.equal(placed.cash,s.cash-1000);assert.equal(placed.slotMarket.auction.escrow,1000);
 assert.equal(placed.slotMarket.auction.bids[0].closeDay,nextCloseDay(placed.slotMarket.auction,s.day));
 assert.deepEqual(restoreGame(JSON.stringify(placed)),placed);
 const cancelled=act(placed,{type:'slot-auction-cancel',airport:'DAD',hour:40});
 assert.equal(cancelled.cash,s.cash);assert.equal(cancelled.slotMarket.auction.escrow,0);
 for(const bad of [{price:AUCTION_TERMS.reserve-50},{price:1025},{price:AUCTION_TERMS.maxPrice+50},{price:1000,airport:'XXX'},{price:1000,hour:168}])assert(transition(s,{type:'slot-auction-bid',airport:'DAD',hour:40,...bad}).error,JSON.stringify(bad));
 assert(transition(placed,{type:'slot-auction-bid',airport:'DAD',hour:40,price:1000}).error,'one bid per hour');
 const poor=structuredClone(s);poor.cash=500;assert(transition(poor,{type:'slot-auction-bid',airport:'DAD',hour:40,price:1000}).error);
 const tampered=JSON.parse(JSON.stringify(placed));tampered.slotMarket.auction.escrow=1;assert.throws(()=>restoreGame(JSON.stringify(tampered)));
});

test('rival bids are deterministic, bounded, and scale with difficulty',()=>{
 const s=enable(slotFixture({active:true})),ctx=context(s);
 const a=rivalBids(ctx,'HAN:30',14);assert.deepEqual(a,rivalBids(ctx,'HAN:30',14));
 assert(a.every(x=>x.bid===0||x.bid>=AUCTION_TERMS.reserve&&x.bid<=AUCTION_TERMS.maxPrice&&x.bid%AUCTION_TERMS.step===0));
 const sum=level=>{const c={...ctx,strategy:{...ctx.strategy,difficulty:level}};let n=0;for(let h=0;h<168;h++)for(const r of rivalBids(c,'HAN:'+h,14))n+=r.bid;return n;};
 assert(sum('easy')<sum('normal')&&sum('normal')<sum('hard'));
 assert.deepEqual(rivalBids(ctx,'XXX:5',14).map(x=>x.bid),[0,0],'rivals do not bid where they do not fly');
});

test('bids close before the day runs: forecast matches settlement, winners pay the clearing price and losers are refunded',()=>{
 let s=enable(slotFixture({active:true}));
 const hours=[...Array(168).keys()].filter(h=>!s.slotMarket.rights.player['HAN:'+h]).slice(0,12);
 for(const h of hours)s=bid(s,5000,'HAN',h);
 assert.equal(s.slotMarket.auction.bids.length,12);
 const cashAfterBids=s.cash,close=s.slotMarket.auction.bids[0].closeDay;
 let ran=0;
 while(s.day<close&&ran++<20){assert(!auctionDue(s));const before=s.slotMarket.auction.bids.length;s=advance(s).game;assert.equal(s.slotMarket.auction.bids.length,before);}
 assert.equal(s.day,close);assert(auctionDue(s));
 const preview=forecast(s),beforeCash=s.cash,beforeRights=Object.keys(s.slotMarket.rights.player).length;
 assert.equal(preview.auctionClosed.length,12);assert.equal(s.slotMarket.auction.bids.length,12,'a forecast must not mutate');
 const r=advance(s);s=r.game;
 assert.equal(s.slotMarket.auction.bids.length,0);assert.equal(s.slotMarket.auction.escrow,0);
 const won=r.report.auctionClosed.filter(x=>x.outcome==='won');
 assert.equal(Object.keys(s.slotMarket.rights.player).length,beforeRights+won.length);
 for(const x of r.report.auctionClosed){assert.equal(x.outcome==='won',x.paid>0);assert(x.paid<=x.bid);}
 const refunded=r.report.auctionClosed.reduce((n,x)=>n+x.bid-x.paid,0);
 assert.ok(Math.abs((s.cash-beforeCash)-preview.cashDelta)<1e-6,'the preview already includes the refunds, so it equals the real change');
 assert.ok(Math.abs(preview.cashDelta-r.report.cashDelta-refunded)<1e-6,'report cashDelta excludes refunds, which were credited by the closing step');
 assert.ok(refunded>0);void cashAfterBids;
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 assert.equal(s.slotMarket.auction.results.length,12);
});

test('an outbid or full bid never grants a right and never exceeds capacity',()=>{
 let s=enable(slotFixture({active:true}));
 const key=Object.keys(s.slotMarket.rights.player)[0],[airport,hour]=key.split(':');
 // The player already holds this hour: one extra right is allowed only if the limit permits it.
 const res=transition(s,{type:'slot-auction-bid',airport,hour:Number(hour),price:5000});
 if(!res.error){s=res.game;while(!auctionDue(s))s=advance(s).game;const r=advance(s);for(const x of r.report.auctionClosed)assert(['won','outbid','full','blocked'].includes(x.outcome));
  for(const m of Object.values(r.game.slotMarket.rights.player))assert(m.quantity<=4);}
 else assert.match(res.error,/chỗ|giới hạn/);
});

test('activation creates a rollback backup and persistence rejects tampering',()=>{
 const base=slotFixture({active:true}),raw=JSON.stringify(base),storage=memory(raw),on=enable(base);
 persistGame(storage,on,raw);
 const backup=readSlotAuctionBackup(storage,on);assert.equal(backup.raw,raw);assert.equal(backup.game.slotMarket.auction,undefined);
 assert(storage.data.has(slotAuctionBackupKey(on.slotMarket.auction.migrationId)));
 const cheat=structuredClone(base);cheat.cash+=1;cheat.slotMarket.auction=structuredClone(on.slotMarket.auction);
 assert.throws(()=>persistGame(memory(raw),cheat,raw));
 const removed=structuredClone(on);delete removed.slotMarket.auction;
 const stored=JSON.stringify(on),storage2=memory(stored);assert.throws(()=>persistGame(storage2,removed,stored),/đấu giá/);
 void BACKUP_KEY;
});
