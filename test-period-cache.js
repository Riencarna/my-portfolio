const fs = require('fs');
const vm = require('vm');

const ctx = vm.createContext({
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Boolean,
  Map,
  Set,
  JSON,
  isFinite,
  isNaN,
  parseInt,
  parseFloat,
});

for (const file of ['js/config.js', 'js/utils.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

function assert(name, condition, detail = '') {
  if (!condition) {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${name}`);
}

console.log('\n[기간별 자산 증감률]');
const periods = [
  { label: '1주', days: 7 },
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
];
const sparseHistory = [
  { date: '2024-01-31', total: 150 },
  { date: '2024-01-25', total: 140 },
  { date: 'invalid', total: 999 },
  { date: '2024-01-01', total: 100 },
  { date: '2024-01-10', total: 120 },
];
const result = ctx.calcSnapshotPeriodChanges(sparseHistory, periods);

assert('정렬되지 않은 기록에서도 최신 날짜를 현재값으로 사용', result[0].currentDate === '2024-01-31');
assert('1주는 기준일 이전의 가장 가까운 실제 기록 사용', result[0].baseDate === '2024-01-10');
assert('목표일 이후 기록은 기간 기준값으로 사용하지 않음', result[0].baseDate !== '2024-01-25');
assert('1주 증감률은 실제 기준값으로 계산', Math.abs(result[0].ret - 25) < 1e-9, String(result[0].ret));
assert('실제 경과 일수 제공', result[0].actualDays === 21, String(result[0].actualDays));
assert('1개월은 30일 전 기록 사용', result[1].baseDate === '2024-01-01');
assert('기록이 부족한 기간은 0%가 아니라 unavailable', result[2].available === false && result[2].ret === null);
assert('입력 기록 배열 순서를 변경하지 않음', sparseHistory[0].date === '2024-01-31');
assert('유효 기록이 1개뿐이면 결과 없음', ctx.calcSnapshotPeriodChanges([{ date: '2024-01-01', total: 100 }], periods) === null);
const zeroBase = ctx.calcSnapshotPeriodChanges([
  { date: '2024-01-01', total: 0 },
  { date: '2024-01-31', total: 100 },
], [{ label: '1개월', days: 30 }]);
assert('기준 자산이 0이면 0%로 위장하지 않음', zeroBase[0].available === false && zeroBase[0].ret === null);

console.log('\n[프록시 캐시 배관]');
const sw = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const config = fs.readFileSync('js/config.js', 'utf8');
for (const host of ['api.codetabs.com', 'api.allorigins.win']) {
  assert(`${host}가 Service Worker API_HOSTS에 포함`, sw.includes(`"${host}"`));
  assert(`${host}가 CSP connect-src에 포함`, index.includes(`https://${host}`));
}
const version = config.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/)?.[1];
assert('Service Worker 캐시명이 앱 버전과 일치', !!version && sw.includes(`myportfolio-v${version}`));
assert('HTML 제목 버전이 앱 버전과 일치', !!version && index.includes(`My Portfolio v${version}`));

if (!process.exitCode) console.log('\n✅ 기간 계산·프록시 캐시 회귀 테스트 통과');
