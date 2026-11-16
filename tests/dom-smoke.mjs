// ShotWrapped 界面冒烟测试：node tests/dom-smoke.mjs
// 用最小 DOM 桩跑 index.html 的两段脚本，走真实流程：
// 点示例 → 出统计和年报卡 → 点深度识别（示例路径）→ 分类出现 → 下载待删清单。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

function makeEl(id) {
  const el = {
    id, _html: '', _text: '', value: '', files: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    style: {}, onclick: null, onchange: null,
    ondragover: null, ondragleave: null, ondrop: null,
    querySelectorAll() { return []; },
    getAttribute() { return null; },
    click() { if (this.onclick) this.onclick(); },
  };
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = String(v); } });
  Object.defineProperty(el, 'textContent', { get() { return el._text; }, set(v) { el._text = String(v); } });
  return el;
}

const registry = {};
const resultsEl = makeEl('results');
resultsEl.classList.add('hidden');
registry['results'] = resultsEl;
const downloads = [];
const sandbox = {
  console,
  module: { exports: {} },
  setTimeout: () => 0,
  document: {
    getElementById(id) { if (!registry[id]) registry[id] = makeEl(id); return registry[id]; },
    createElement() { return makeEl('a'); },
  },
  Blob: class { constructor(parts) { this.parts = parts; downloads.push(this); } },
  URL: { createObjectURL() { return 'blob:fake'; }, revokeObjectURL() {} },
};
vm.createContext(sandbox);
for (const code of scripts) vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(name + ' → ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// 1. 点示例
registry['demoBtn'].click();
t('示例后结果区显示', () => ok(!resultsEl.classList.contains('hidden'), 'results 还藏着'));
t('示例总数 428 张', () => ok(registry['statTotal'].textContent === '428 张', '实际：' + registry['statTotal'].textContent));
t('示例状态说明是虚构数据', () => ok(registry['status'].textContent.includes('虚构截图'), 'status 没说明示例性质'));
t('年报卡渲染出五张且带下载按钮', () => {
  const h = registry['cards'].innerHTML;
  ok(h.includes('我的截图年报') && h.includes('能腾出的空间'), '卡片标题不全');
  ok((h.match(/data-card=/g) || []).length === 5, '应有 5 个下载按钮，实际 ' + (h.match(/data-card=/g) || []).length);
  ok(h.includes('待识别'), '没识别前第四张应是待识别');
});
t('去重面板有数字', () => ok(registry['dupBox'].textContent.includes('重复截图'), 'dupBox 没内容'));

// 2. 点深度识别（示例路径，同步完成）
registry['ocrBtn'].click();
t('识别后分类条出现', () => ok(registry['catBox'].innerHTML.includes('bar-row'), 'catBox 没出分类条'));
t('识别后第四张卡不再是待识别', () => ok(!registry['cards'].innerHTML.includes('待识别'), '卡片没更新'));
t('识别后状态有交代', () => ok(registry['status'].textContent.includes('示例模式'), 'status 不对'));

// 3. 下载待删清单
registry['delBtn'].click();
t('待删清单真的生成了', () => {
  ok(downloads.length >= 1, '没有下载产生');
  const txt = downloads[downloads.length - 1].parts.join('');
  ok(txt.includes('# ShotWrapped 待删清单'), '清单标题不对');
  ok(txt.includes('Screenshot_2026'), '清单里应有示例文件名');
});

console.log('ShotWrapped 界面冒烟：' + pass + ' 通过，' + fail + ' 失败');
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
