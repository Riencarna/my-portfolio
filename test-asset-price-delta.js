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

if (!process.exitCode) console.log('\n✅ 자산 수량을 제외한 가격 변동 테스트 통과');
