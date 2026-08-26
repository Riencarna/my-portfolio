const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/styles.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(
  html,
  /name="viewport"[^>]+viewport-fit=cover/,
  'iOS 안전 영역을 사용하려면 viewport-fit=cover가 유지되어야 합니다.'
);

for (const token of [
  '--safe-area-top',
  '--safe-area-right',
  '--safe-area-bottom',
  '--safe-area-left',
  '--mobile-bottom-clearance'
]) {
  assert.ok(css.includes(token), `${token} 안전 영역 토큰이 필요합니다.`);
}

assert.match(css, /\.bottom-nav\s*\{[\s\S]*?var\(--safe-area-bottom\)/);
assert.match(css, /\.main-content\s*\{[\s\S]*?var\(--mobile-bottom-clearance\)/);
assert.match(css, /\.fab-container\s*\{[\s\S]*?var\(--mobile-bottom-clearance\)/);
assert.match(css, /\.toast-container\s*\{[\s\S]*?var\(--mobile-bottom-clearance\)/);
assert.match(css, /\.modal\s*\{[\s\S]*?var\(--safe-area-bottom\)/);
assert.match(css, /@media\(max-width:430px\)[\s\S]*?iPhone 16 Pro|iPhone 16 Pro[\s\S]*?@media\(max-width:430px\)/);

console.log('mobile safe-area checks passed');
