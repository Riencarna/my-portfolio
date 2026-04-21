#!/usr/bin/env node
/*
 * bump.js — 버전 번호 일괄 치환 도우미
 *
 * 사용법:
 *   node bump.js patch     # 5.12.0 -> 5.12.1 (버그 수정)
 *   node bump.js minor     # 5.12.0 -> 5.13.0 (기능 추가)
 *   node bump.js major     # 5.12.0 -> 6.0.0  (큰 변화)
 *   node bump.js 5.12.5    # 명시 버전
 *   node bump.js --dry patch   # 미리보기 (실제 수정 안 함)
 *
 * 기준 버전: js/config.js 의 APP_VERSION.
 * 치환 대상: 프로젝트 루트의 주요 파일 + js/ 디렉토리 모든 .js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_FILE = 'js/config.js';

// ── 인자 파싱 ──
const args = process.argv.slice(2);
let dryRun = false;
const posArgs = [];
for (const a of args) {
  if (a === '--dry' || a === '--dry-run') dryRun = true;
  else posArgs.push(a);
}
const bumpArg = posArgs[0];

if (!bumpArg) {
  console.error('사용법: node bump.js <patch|minor|major|x.y.z> [--dry]');
  process.exit(1);
}

// ── 현재 버전 읽기 ──
const configPath = path.join(ROOT, CONFIG_FILE);
if (!fs.existsSync(configPath)) {
  console.error(`${CONFIG_FILE} 를 찾을 수 없습니다.`);
  process.exit(1);
}
const configContent = fs.readFileSync(configPath, 'utf8');
const match = configContent.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
if (!match) {
  console.error(`${CONFIG_FILE} 에서 APP_VERSION 을 찾을 수 없습니다.`);
  process.exit(1);
}
const current = match[1];

// ── 다음 버전 계산 ──
let next;
if (/^\d+\.\d+\.\d+$/.test(bumpArg)) {
  next = bumpArg;
} else {
  const parts = current.split('.').map(Number);
  const [maj, min, pat] = parts;
  if (bumpArg === 'patch') next = `${maj}.${min}.${pat + 1}`;
  else if (bumpArg === 'minor') next = `${maj}.${min + 1}.0`;
  else if (bumpArg === 'major') next = `${maj + 1}.0.0`;
  else {
    console.error(`알 수 없는 인자: "${bumpArg}"`);
    console.error('사용 가능: patch | minor | major | x.y.z');
    process.exit(1);
  }
}

if (current === next) {
  console.log(`이미 ${current} 입니다. 변경할 것이 없습니다.`);
  process.exit(0);
}

console.log(`${current} -> ${next}${dryRun ? '  [DRY RUN]' : ''}`);
console.log('');

// ── 대상 파일 수집 ──
const fixedTargets = ['index.html', 'css/styles.css', 'manifest.json', 'sw.js', CONFIG_FILE];
const jsDir = path.join(ROOT, 'js');
const jsFiles = fs.readdirSync(jsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => `js/${f}`);

const targets = Array.from(new Set([...fixedTargets, ...jsFiles]));

// ── 치환 ──
const escapedCurrent = current.replace(/\./g, '\\.');
const regex = new RegExp(escapedCurrent, 'g');

let totalReplacements = 0;
let touchedFiles = 0;

for (const rel of targets) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`  [건너뜀] ${rel} (파일 없음)`);
    continue;
  }
  const content = fs.readFileSync(abs, 'utf8');
  const matches = content.match(regex);
  if (!matches || matches.length === 0) {
    console.log(`  ${rel}: 해당 버전 문자열 없음`);
    continue;
  }
  const updated = content.replace(regex, next);
  if (!dryRun) {
    fs.writeFileSync(abs, updated);
  }
  console.log(`  ${rel}: ${matches.length}곳 치환`);
  totalReplacements += matches.length;
  touchedFiles++;
}

console.log('');
if (dryRun) {
  console.log(`[DRY RUN] ${touchedFiles}개 파일에서 총 ${totalReplacements}곳 치환 예정 (실제 수정 안 함)`);
} else {
  console.log(`완료: ${touchedFiles}개 파일, 총 ${totalReplacements}곳 치환`);
}

console.log('');
console.log('다음 할 일:');
console.log('  1. 변경사항 확인:  git diff');
console.log('  2. 커밋 + 푸시');
