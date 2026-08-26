const fs = require('fs');
const vm = require('vm');

const ctx = vm.createContext({
  console, Date, Math, Number, String, Array, Object, Boolean, Map, Set, JSON, Intl, Promise,
  isFinite, isNaN, parseInt, parseFloat,
  Cleanup: { scope: () => ({ add() {}, removeAll() {} }) },
});

for (const file of ['js/config.js', 'js/utils.js', 'js/store.js', 'js/ui-dashboard.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`✓ ${name}`);
    return;
  }
  console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
  process.exitCode = 1;
}

console.log('\n[자산별 가격 변동만 계산]');

const qqqTen = {
  id: 'qqq', name: 'QQQ', category: '해외주식', amount: 100,
  txns: [{ type: 'buy', qty: 10, price: 90, date: '2026-08-01' }],
};
const qqqTwenty = {
  ...qqqTen,
  txns: [...qqqTen.txns, { type: 'buy', qty: 10, price: 100, date: '2026-08-26' }],
};

const samePrice = ctx.calcPriceOnlyAssetDelta(ctx.calcAssetValue(qqqTwenty), 100);
assert('QQQ 수량만 10주 늘면 가격 변동액은 0원', samePrice?.amount === 0, JSON.stringify(samePrice));
assert('수량만 늘어난 경우 증감 배지를 표시하지 않음', ctx._renderAssetDeltaBadge(qqqTwenty, ctx.calcAssetValue(qqqTwenty), { qqq: 100 }) === '');

qqqTwenty.amount = 110;
const priceUp = ctx.calcPriceOnlyAssetDelta(ctx.calcAssetValue(qqqTwenty), 100);
assert('현재 20주·단가 10원 상승이면 가격 변동액은 200원', priceUp?.amount === 200, JSON.stringify(priceUp));
const upBadge = ctx._renderAssetDeltaBadge(qqqTwenty, ctx.calcAssetValue(qqqTwenty), { qqq: 100 });
assert('가격 상승 때만 증가 배지를 표시', upBadge.includes('▲') && upBadge.includes('₩200'));
assert('접근성 설명에 수량 변동 제외를 명시', upBadge.includes('수량 변동 제외'));

qqqTwenty.amount = 95;
const priceDown = ctx.calcPriceOnlyAssetDelta(ctx.calcAssetValue(qqqTwenty), 100);
assert('현재 20주·단가 5원 하락이면 가격 변동액은 -100원', priceDown?.amount === -100, JSON.stringify(priceDown));
assert('가격 하락 배지를 표시', ctx._renderAssetDeltaBadge(qqqTwenty, ctx.calcAssetValue(qqqTwenty), { qqq: 100 }).includes('▼'));

assert('구버전 기록처럼 이전 단가가 없으면 잘못된 배지를 숨김', ctx._renderAssetDeltaBadge(qqqTwenty, ctx.calcAssetValue(qqqTwenty), null) === '');
assert('신규 자산처럼 해당 이전 단가가 없으면 배지를 숨김', ctx._renderAssetDeltaBadge(qqqTwenty, ctx.calcAssetValue(qqqTwenty), {}) === '');

vm.runInContext(`
  appState.assets = [{
    id: 'qqq', name: 'QQQ', category: '해외주식', amount: 123,
    txns: [{ type: 'buy', qty: 3, price: 100, date: '2026-08-01' }]
  }];
  appState.history = [];
  makeSnapshot();
`, ctx);
const snapshot = vm.runInContext('appState.history[0]', ctx);
assert('일별 기록에 총 평가액 보존', snapshot.byAsset.qqq === 369);
assert('일별 기록에 자산별 단가 추가 저장', snapshot.byAssetPrice.qqq === 123);
assert('오늘 첫 단가를 별도 기준으로 저장', snapshot.byAssetStartPrice.qqq === 123);

vm.runInContext(`appState.assets[0].amount = 130; makeSnapshot();`, ctx);
const intradaySnapshot = vm.runInContext('appState.history[0]', ctx);
assert('같은 날 최신 단가는 계속 갱신', intradaySnapshot.byAssetPrice.qqq === 130);
assert('같은 날 오늘 첫 단가는 덮어쓰지 않음', intradaySnapshot.byAssetStartPrice.qqq === 123);
const intradayRefs = ctx.getAssetDeltaReferences();
assert('이전 날짜 단가가 없으면 오늘 첫 단가를 비교 기준으로 사용',
  intradayRefs.qqq?.price === 123 && intradayRefs.qqq?.basis === 'today', JSON.stringify(intradayRefs));
const intradayBadge = ctx._renderAssetDeltaBadge(
  vm.runInContext('appState.assets[0]', ctx),
  ctx.calcAssetValue(vm.runInContext('appState.assets[0]', ctx)),
  intradayRefs,
);
assert('같은 날 가격이 바뀌면 즉시 증감 배지 표시',
  intradayBadge.includes('▲') && intradayBadge.includes('₩21'));
assert('당일 기준 배지에 오늘 첫 저장 가격 기준을 안내', intradayBadge.includes('오늘 첫 저장 가격'));

const todayStr = ctx.today();
const previousDate = new Date(`${todayStr}T12:00:00`);
previousDate.setDate(previousDate.getDate() - 1);
const previousDateStr = previousDate.toISOString().slice(0, 10);
ctx.previousDateStr = previousDateStr;
vm.runInContext(`
  appState.history = [
    { date: previousDateStr, total: 270, byCategory: {}, byAsset: { qqq: 270 }, byAssetPrice: { qqq: 90 } },
    { date: today(), total: 390, byCategory: {}, byAsset: { qqq: 390 }, byAssetPrice: { qqq: 130 }, byAssetStartPrice: { qqq: 123 } }
  ];
`, ctx);
const previousRefs = ctx.getAssetDeltaReferences();
assert('이전 날짜 단가가 있으면 오늘 첫 단가보다 우선',
  previousRefs.qqq?.price === 90 && previousRefs.qqq?.basis === 'previous', JSON.stringify(previousRefs));
const previousBadge = ctx._renderAssetDeltaBadge(
  vm.runInContext('appState.assets[0]', ctx),
  ctx.calcAssetValue(vm.runInContext('appState.assets[0]', ctx)),
  previousRefs,
);
assert('이전 날짜 기준 배지에 이전 기록 가격 기준을 안내', previousBadge.includes('이전 기록 가격'));

vm.runInContext(`
  appState.history = [{
    date: today(), total: 303, byCategory: {}, byAsset: { qqq: 303 }, byAssetPrice: { qqq: 101 }
  }];
  appState.assets[0].amount = 102;
  makeSnapshot();
`, ctx);
const migratedSnapshot = vm.runInContext('appState.history[0]', ctx);
assert('구버전 당일 기록은 기존 마지막 단가를 오늘 첫 단가로 안전하게 승계',
  migratedSnapshot.byAssetStartPrice.qqq === 101 && migratedSnapshot.byAssetPrice.qqq === 102,
  JSON.stringify(migratedSnapshot));

vm.runInContext(`
  appState.assets = [{
    id: 'btc', name: '비트코인', category: '코인', amount: 100,
    txns: [{ type: 'buy', qty: 2, price: 80, date: '2026-08-01' }]
  }];
  appState.history = [];
  makeSnapshot();
  appState.assets[0].amount = 105;
  makeSnapshot();
`, ctx);
const coinRefs = ctx.getAssetDeltaReferences();
const coinBadge = ctx._renderAssetDeltaBadge(
  vm.runInContext('appState.assets[0]', ctx),
  ctx.calcAssetValue(vm.runInContext('appState.assets[0]', ctx)),
  coinRefs,
);
assert('코인은 당일 두 번째 가격 업데이트부터 가치 증감 표시',
  coinRefs.btc?.basis === 'today' && coinBadge.includes('▲') && coinBadge.includes('₩10'));

if (!process.exitCode) console.log('\n✅ 자산 수량을 제외한 가격 변동 테스트 통과');
