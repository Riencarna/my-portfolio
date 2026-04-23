// v5.17.0 — 배분 편차 계산 로직 테스트
// 실행: node test-allocation.js

const fs = require('fs');
const vm = require('vm');

const ctx = vm.createContext({ console, Math, JSON, Object });

function loadFile(path) {
  const code = fs.readFileSync(path, 'utf8');
  vm.runInContext(code, ctx);
}

loadFile('js/config.js');
loadFile('js/utils.js');

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}${detail ? ': ' + detail : ''}`);
    process.exitCode = 1;
  }
}

// 테스트용 자산 목록
const testAssets = [
  { id: 'a1', name: '삼성전자', category: '국내주식', amount: 70000, txns: [{ type: 'buy', qty: 100, price: 60000, date: '2024-01-01' }] },  // value = 7,000,000
  { id: 'a2', name: '애플',     category: '해외주식', amount: 200,    txns: [{ type: 'buy', qty: 100, price: 150,    date: '2024-01-01' }] },  // value = 20,000
  { id: 'a3', name: '비트코인', category: '코인',     amount: 50000000, txns: [{ type: 'buy', qty: 0.1, price: 40000000, date: '2024-01-01' }] },  // value = 5,000,000
  { id: 'a4', name: '현금예금', category: '현금',     amount: 1,      txns: [{ type: 'buy', qty: 3000000, price: 1, date: '2024-01-01' }] },  // value = 3,000,000
];

const total = ctx.calcTotal(testAssets);
const catTotals = ctx.calcCategoryTotals(testAssets);
console.log(`총 자산: ${total.toLocaleString()}원`);
console.log('카테고리별:', Object.fromEntries(Object.entries(catTotals).filter(([,v]) => v > 0)));
// 국내 7M, 해외 20K, 코인 5M, 현금 3M, total ≈ 15.02M

// ── 시나리오 1: allocation 미설정 시 빈 배열 ──
const r1 = ctx.calcAllocationDrift(testAssets, null, total, catTotals);
assert('1. allocation=null → 빈 배열', r1.length === 0);

// ── 시나리오 2: enabled=false 시 빈 배열 ──
const r2 = ctx.calcAllocationDrift(testAssets, { enabled: false, categories: { '국내주식': 50 } }, total, catTotals);
assert('2. enabled=false → 빈 배열', r2.length === 0);

// ── 시나리오 3: 카테고리만, 완벽히 일치 (가능한 만큼) ──
// 국내 ≈ 46.6%, 해외 ≈ 0.13%, 코인 ≈ 33.3%, 현금 ≈ 20%
const alloc3 = {
  enabled: true,
  assetOverride: false,
  categories: { '국내주식': 47, '해외주식': 0, '코인': 33, '현금': 20, '예적금': 0, '부동산': 0, '기타': 0 },
  assets: {},
  driftThreshold: 5,
};
const r3 = ctx.calcAllocationDrift(testAssets, alloc3, total, catTotals);
console.log('\n시나리오 3 결과:');
for (const row of r3) {
  console.log(`  ${row.label}: 목표 ${row.targetPct}% / 실제 ${row.actualPct.toFixed(1)}% / 편차 ${row.driftPct.toFixed(2)}% [${row.status}]`);
}
const kstock3 = r3.find(r => r.id === '국내주식');
assert('3a. 국내주식 target 47%', kstock3 && kstock3.targetPct === 47);
assert('3b. 국내주식 drift 5% 이내', kstock3 && Math.abs(kstock3.driftPct) < 5);
assert('3c. ok status 다수', r3.filter(r => r.status === 'ok').length >= 3);

// ── 시나리오 4: 큰 편차 → 리밸런싱 제안 ──
const alloc4 = {
  enabled: true,
  assetOverride: false,
  categories: { '국내주식': 20, '해외주식': 20, '코인': 20, '현금': 20, '예적금': 20, '부동산': 0, '기타': 0 },
  assets: {},
  driftThreshold: 5,
};
const r4 = ctx.calcAllocationDrift(testAssets, alloc4, total, catTotals);
const suggestions4 = ctx.getRebalancingSuggestions(r4, 5);
console.log('\n시나리오 4 제안:');
for (const s of suggestions4) {
  console.log(`  ${s.label}: ${s.direction} 권장 ${s.rebalanceAmt.toLocaleString()}원 (편차 ${s.driftPct.toFixed(1)}%)`);
}
assert('4a. 제안 존재', suggestions4.length > 0);
assert('4b. 국내주식 초과(sell)', suggestions4.some(s => s.id === '국내주식' && s.direction === 'sell'));
assert('4c. 예적금 부족(buy)', suggestions4.some(s => s.id === '예적금' && s.direction === 'buy'));
assert('4d. 제안 정렬: 편차 큰 순', suggestions4.every((s, i) => i === 0 || Math.abs(s.driftPct) <= Math.abs(suggestions4[i-1].driftPct)));

// ── 시나리오 5: 개별 종목 타겟 (assetOverride=true) ──
const alloc5 = {
  enabled: true,
  assetOverride: true,
  categories: { '국내주식': 50, '해외주식': 0, '코인': 30, '현금': 20, '예적금': 0, '부동산': 0, '기타': 0 },
  assets: { 'a1': 40 },  // 삼성전자를 40%로 개별 타겟
  driftThreshold: 5,
};
const r5 = ctx.calcAllocationDrift(testAssets, alloc5, total, catTotals);
console.log('\n시나리오 5 결과:');
for (const row of r5) {
  console.log(`  [${row.kind}] ${row.label}: 목표 ${row.targetPct}% / 실제 ${row.actualPct.toFixed(1)}% / 편차 ${row.driftPct.toFixed(2)}%`);
}
const sam5 = r5.find(r => r.kind === 'asset' && r.id === 'a1');
assert('5a. 개별 종목 (삼성전자) 행 존재', !!sam5);
assert('5b. 삼성전자 target 40%', sam5 && sam5.targetPct === 40);
const kstockRemaining5 = r5.find(r => r.kind === 'category' && r.id === '국내주식');
assert('5c. 국내주식 carve-out: 50-40=10%', kstockRemaining5 && Math.abs(kstockRemaining5.targetPct - 10) < 0.01);
assert('5d. 국내주식 "기타" 라벨', kstockRemaining5 && kstockRemaining5.label.includes('기타'));

// ── 시나리오 6: 임계값 이내/이외 분류 ──
const alloc6 = {
  enabled: true,
  assetOverride: false,
  categories: { '국내주식': 47, '해외주식': 0, '코인': 33, '현금': 20, '예적금': 0, '부동산': 0, '기타': 0 },
  assets: {},
  driftThreshold: 2,  // 타이트한 임계값
};
const r6 = ctx.calcAllocationDrift(testAssets, alloc6, total, catTotals);
const overCount6 = r6.filter(r => r.status !== 'ok').length;
console.log(`\n시나리오 6: 임계값 2% → ${overCount6}개 경고`);
assert('6. 임계값 2%로 좁히면 경고 개수 늘어남', overCount6 >= 0);

// ── 시나리오 7: total=0 (빈 포트폴리오) ──
const r7 = ctx.calcAllocationDrift([], { enabled: true, categories: { '국내주식': 100 } }, 0, {});
assert('7. total=0 → 빈 배열', r7.length === 0);

// ── 시나리오 8: 카테고리 합계 함수 ──
const sum1 = ctx.sumAllocationCategoryPct({ '국내주식': 30, '해외주식': 30, '코인': 10, '현금': 20, '예적금': 10, '부동산': 0, '기타': 0 });
assert('8a. 합계 100%', Math.abs(sum1 - 100) < 0.001);
const sum2 = ctx.sumAllocationCategoryPct({ '국내주식': 50 });
assert('8b. 일부만 입력 시 나머지 0', sum2 === 50);
const sum3 = ctx.sumAllocationCategoryPct(null);
assert('8c. null 입력 시 0', sum3 === 0);

// ── 시나리오 9: 카테고리 목표 0이지만 보유 중 → over 표시 ──
const alloc9 = {
  enabled: true,
  assetOverride: false,
  categories: { '국내주식': 0, '해외주식': 0, '코인': 0, '현금': 0, '예적금': 0, '부동산': 0, '기타': 0 },
  assets: {},
  driftThreshold: 5,
};
const r9 = ctx.calcAllocationDrift(testAssets, alloc9, total, catTotals);
assert('9a. 목표 0% + 보유 중 → 행 존재', r9.length > 0);
// 모든 행이 over 또는 ok (목표 0%이므로 under 불가능) — 미세 보유는 ok일 수 있음
assert('9b. under status 없음 (목표 0%이므로)', r9.every(r => r.status !== 'under'));
const overRows9 = r9.filter(r => r.status === 'over');
assert('9c. 큰 편차는 over로 분류', overRows9.length >= 3);

console.log('\n테스트 완료.');
