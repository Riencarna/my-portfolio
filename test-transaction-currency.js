const fs = require('fs');
const vm = require('vm');

const ctx = vm.createContext({
  console, Date, Math, Number, String, Array, Object, Boolean, Map, Set, JSON, Intl,
  isFinite, isNaN, parseInt, parseFloat,
  appState: { assets: [] },
});

for (const file of ['js/config.js', 'js/utils.js', 'js/ui-history.js']) {
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

const legacy = ctx.sanitizeTxn({ price: 10000, qty: 2, date: '2026-08-01' });
assert('기존 거래는 KRW로 호환', legacy.currency === 'KRW' && legacy.originalPrice === 10000 && legacy.fxRate === null);

const usd = ctx.sanitizeTxn({
  price: 141000, qty: 2, date: '2026-08-01',
  currency: 'USD', originalPrice: 100, fxRate: 1410,
});
assert('USD 원본 단가와 환율 보존', usd.currency === 'USD' && usd.originalPrice === 100 && usd.fxRate === 1410);
assert('USD와 원화 합계를 함께 표시', ctx.fmtTxnTotal(usd) === '$200.00 (₩282,000)', ctx.fmtTxnTotal(usd));

const headers = ['자산명', '카테고리', '유형', '통화', '원본 단가', '적용 환율', '수량', '날짜'];
const mapping = ctx.detectColumnMapping(headers);
assert('CSV 통화·환율 열 자동 감지', mapping.currency === 3 && mapping.price === 4 && mapping.fxRate === 5);

const rows = ctx._buildImportRows([
  ['애플', '해외주식', '매수', 'USD', '100', '1410', '2', '2026-08-01'],
  ['삼성전자', '국내주식', '매수', 'KRW', '70000', '', '3', '2026-08-02'],
], mapping);
ctx.globalRows = rows;
vm.runInContext('_csvImportState = { rows: globalRows, defaultCurrency: "", exchangeRate: 1400 }', ctx);
ctx._refreshCSVImportRows();
assert('USD CSV를 원화 단가로 환산', rows[0].valid && rows[0].price === 141000 && rows[0].fxRate === 1410);
assert('KRW CSV는 금액을 그대로 유지', rows[1].valid && rows[1].price === 70000 && rows[1].fxRate === null);

const symbolRows = ctx._buildImportRows([
  ['테슬라', '해외주식', '매수', '', '$250', '', '1', '2026-08-03'],
], mapping);
ctx.globalSymbolRows = symbolRows;
vm.runInContext('_csvImportState = { rows: globalSymbolRows, defaultCurrency: "", exchangeRate: 1400 }', ctx);
ctx._refreshCSVImportRows();
assert('$ 기호로 USD를 자동 감지', symbolRows[0].currency === 'USD' && symbolRows[0].price === 350000);
assert('통화 열과 금액 기호 충돌 감지', ctx._normalizeImportCurrency('KRW', '$100') === 'CONFLICT');

const missingRows = ctx._buildImportRows([
  ['통화없음', '해외주식', '매수', '', '100', '', '1', '2026-08-04'],
], mapping);
ctx.globalMissingRows = missingRows;
vm.runInContext('_csvImportState = { rows: globalMissingRows, defaultCurrency: "", exchangeRate: 1400 }', ctx);
ctx._refreshCSVImportRows();
assert('통화가 없는 행은 선택 전까지 유효하지 않음', !missingRows[0].valid && missingRows[0].price === 0);
vm.runInContext('_csvImportState.defaultCurrency = "USD"', ctx);
ctx._refreshCSVImportRows();
assert('파일 기본 통화 USD 선택 후 환산', missingRows[0].valid && missingRows[0].price === 140000);

const modalSource = fs.readFileSync('js/ui-modals.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const historySource = fs.readFileSync('js/ui-history.js', 'utf8');
const apiSource = fs.readFileSync('js/api.js', 'utf8');
const controllerChangeBody = appSource.match(/addEventListener\('controllerchange',[\s\S]*?\n  \}\);/)?.[0] || '';
assert('확인 작업은 모달 닫기 완료 후 실행', modalSource.includes("await closeModal('modalConfirm');") && modalSource.indexOf("await closeModal('modalConfirm');") < modalSource.indexOf('await onConfirm();'));
assert('업데이트 controllerchange에서 자동 새로고침 제거', controllerChangeBody.length > 0 && !controllerChangeBody.includes('location.reload'));
assert('사용자 새로고침 전에 저장 대기열 비우기', appSource.includes('await flushPendingSave()'));
assert('작성 중 모달이 있으면 새로고침 재확인', appSource.includes('작성 중인 입력 내용은 아직 저장되지 않았습니다'));
assert('KRW 전용 CSV는 환율 API를 요구하지 않음', historySource.includes("row.declaredCurrency === 'USD' && !row.rowFxRate"));
assert('출처 없는 기본 환율은 금융 입력에 사용하지 않음', apiSource.includes('async function fetchReliableExchangeRate()') && apiSource.includes("const info = getRateDisplayInfo('usdkrw');") && apiSource.includes('if (!info || !Number.isFinite(info.rate) || info.rate <= 0) return null;'));
assert('USD 거래 추가·수정에서 환율 직접 입력 가능', modalSource.includes('id="addTxFxRate"') && modalSource.includes('id="txFxRate"') && modalSource.includes('id="editTxnFxRate"'));
assert('비동기 거래 저장 중 중복 클릭 차단', modalSource.includes("submitBtn.disabled = true; submitBtn.textContent = '처리 중…'") && modalSource.includes("submitBtn.disabled = true; submitBtn.textContent = '저장 중…'"));
assert('오래된 환율 요청은 새 입력창에 적용하지 않음', modalSource.includes("$('#addAssetFormGeneration')?.value !== formGeneration") && modalSource.includes("$('#transactionFormGeneration')?.value !== formGeneration"));
assert('환율 조회 중 닫은 거래창은 저장하지 않음', modalSource.includes("!modal?.classList.contains('active') || modal.getAttribute('aria-hidden') === 'true'"));

if (!process.exitCode) console.log('\n✅ 거래 통화 보존·CSV 환산 테스트 통과');
