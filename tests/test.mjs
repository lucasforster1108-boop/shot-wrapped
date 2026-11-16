// ShotWrapped 自测：node tests/test.mjs
// 做法：读 index.html，把 <script> 块放进 vm 里跑（不提供 document，界面层自动跳过），只测纯函数。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 2) throw new Error('index.html 里应有 2 个 script 块（纯函数 + 界面层），实际 ' + scripts.length);

const sandbox = { console, module: { exports: {} } };
vm.createContext(sandbox);
for (const code of scripts) vm.runInContext(code, sandbox);
const SW = sandbox.module.exports;
for (const fn of ['isScreenshotFile', 'parseDateFromName', 'entryDate', 'formatBytes', 'computeStats',
  'hashFromGrid', 'hammingDistance', 'findDuplicates', 'categorizeText', 'analyzeSample',
  'estimateReclaimable', 'personaFor', 'buildCards', 'buildDeleteList', 'pickSample']) {
  if (typeof SW[fn] !== 'function') throw new Error('缺少导出函数: ' + fn);
}

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(name + ' → ' + e.message); }
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error((msg || '') + '：期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- 文件名日期 ----------
t('安卓截图名解析出完整时间', () => {
  const ms = SW.parseDateFromName('Screenshot_20261105-143022.png');
  eq(new Date(ms).getHours(), 14); eq(new Date(ms).getMinutes(), 30);
  eq(SW.dayKey(ms), '2026-11-05');
});
t('带横杠的日期时间也能解析', () => {
  const ms = SW.parseDateFromName('Screenshot 2026-03-14 231522.png');
  eq(SW.dayKey(ms), '2026-03-14'); eq(new Date(ms).getHours(), 23);
});
t('只有日期时用中午兜底（不算深夜）', () => {
  const ms = SW.parseDateFromName('IMG_2026-07-01_backup.png');
  eq(new Date(ms).getHours(), 12);
});
t('非法月份返回 null', () => eq(SW.parseDateFromName('Screenshot_20261305-143022.png'), null));
t('2 月 31 日返回 null', () => eq(SW.parseDateFromName('Screenshot_20260231-143022.png'), null));
t('普通文件名返回 null', () => eq(SW.parseDateFromName('photo-final-v2.png'), null));
t('entryDate 文件名优先，没有才用 lastModified', () => {
  eq(SW.dayKey(SW.entryDate({ name: 'Screenshot_20260102-030405.png', lastModified: 0 })), '2026-01-02');
  const fb = new Date(2026, 5, 6, 10, 0, 0).getTime();
  eq(SW.entryDate({ name: 'IMG_1234.png', lastModified: fb }), fb);
});

// ---------- 基础工具 ----------
t('isScreenshotFile', () => {
  ok(SW.isScreenshotFile('Screenshot_2026.png'), 'Screenshot 应为真');
  ok(SW.isScreenshotFile('截屏2026-11-05.png'), '截屏应为真');
  ok(SW.isScreenshotFile('IMG_1234.jpg'), '图片后缀兜底应为真');
  ok(!SW.isScreenshotFile('notes.txt'), 'txt 应为假');
});
t('formatBytes', () => {
  eq(SW.formatBytes(512), '512 B');
  eq(SW.formatBytes(2048), '2 KB');
  eq(SW.formatBytes(1572864), '1.5 MB');
  eq(SW.formatBytes(1610612736), '1.5 GB');
});
t('fmtMonth / fmtDate', () => {
  eq(SW.fmtMonth('2026-11'), '2026 年 11 月');
  eq(SW.fmtDate(new Date(2026, 2, 14).getTime()), '2026 年 3 月 14 日');
});

// ---------- 统计 ----------
const E = (name, size, y, mo, d, h) => ({ name, size, lastModified: new Date(y, mo - 1, d, h || 12, 0, 0).getTime() });
t('computeStats 基本账', () => {
  const s = SW.computeStats([
    E('Screenshot_20261101-100000.png', 1000, 2026, 11, 1, 10),
    E('Screenshot_20261102-233000.png', 2000, 2026, 11, 2, 23),
    E('Screenshot_20260314-120000.png', 3000, 2026, 3, 14, 12),
    E('Screenshot_20261102-010000.png', 4000, 2026, 11, 2, 1),
  ]);
  eq(s.count, 4); eq(s.totalBytes, 10000);
  eq(s.busiestMonth.month, '2026-11'); eq(s.busiestMonth.count, 3);
  eq(s.nightCount, 2); eq(s.nightRatio, 0.5);
  eq(s.topYear.year, '2026');
  eq(s.byMonth.map((m) => m.month), ['2026-03', '2026-11']);
  eq(s.busiestDay.count, 2);
});
t('computeStats 空输入不炸', () => {
  const s = SW.computeStats([]);
  eq(s.count, 0); eq(s.busiestMonth, null); eq(s.nightRatio, 0);
});
t('深夜口径：23 点和凌晨 4 点算，5 点不算', () => {
  const s = SW.computeStats([
    E('a.png', 1, 2026, 1, 1, 23), E('b.png', 1, 2026, 1, 2, 4), E('c.png', 1, 2026, 1, 3, 5),
  ]);
  eq(s.nightCount, 2);
});

// ---------- 感知哈希与去重 ----------
t('hashFromGrid：平坦图全 0，递减图全 f', () => {
  eq(SW.hashFromGrid(new Array(72).fill(128)), '0000000000000000');
  const dec = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) dec.push(255 - c * 20);
  eq(SW.hashFromGrid(dec), 'ffffffffffffffff');
});
t('hashFromGrid 长度不对抛错', () => {
  let threw = false;
  try { SW.hashFromGrid([1, 2, 3]); } catch (e) { threw = true; }
  ok(threw, '应抛错');
});
t('hammingDistance', () => {
  eq(SW.hammingDistance('0000000000000000', 'ffffffffffffffff'), 64);
  eq(SW.hammingDistance('abcd', 'abcd'), 0);
  eq(SW.hammingDistance('abcd', 'abc'), Infinity);
});
t('findDuplicates：完全相同和近似都算，留最早一张', () => {
  const entries = [
    { name: 'Screenshot_20260101-100000.png', size: 100, hash: '0000000000000000', lastModified: new Date(2026, 0, 1).getTime() },
    { name: 'Screenshot_20260201-100000.png', size: 200, hash: '0000000000000000', lastModified: new Date(2026, 1, 1).getTime() },
    { name: 'Screenshot_20260301-100000.png', size: 300, hash: '1000000000000000', lastModified: new Date(2026, 2, 1).getTime() },
    { name: 'Screenshot_20260401-100000.png', size: 400, hash: 'ffffffffffffffff', lastModified: new Date(2026, 3, 1).getTime() },
    { name: 'no-hash.png', size: 500, lastModified: new Date(2026, 4, 1).getTime() },
  ];
  const d = SW.findDuplicates(entries);
  eq(d.groups.length, 1);
  eq(d.extraCount, 2); // 第 2 张（同哈希）+ 第 3 张（距离 1，近似）
  eq(d.wastedBytes, 500);
  ok(!d.extraIndices.includes(0), '最早一张是保留的，不该进多余名单');
  ok(!d.extraIndices.includes(3), '完全不同的图不该算重复');
  ok(!d.extraIndices.includes(4), '没哈希的不参与');
});
t('findDuplicates：阈值 0 时近似不算', () => {
  const entries = [
    { name: 'a.png', size: 10, hash: '0000000000000000', lastModified: 1 },
    { name: 'b.png', size: 10, hash: '1000000000000000', lastModified: 2 },
  ];
  eq(SW.findDuplicates(entries, 0).extraCount, 0);
});

// ---------- 分类 ----------
t('categorizeText 各类关键词', () => {
  eq(SW.categorizeText('您的验证码是 123456'), '时效垃圾');
  eq(SW.categorizeText('取件码 8-2-3091 快递单号 SF123'), '时效垃圾');
  eq(SW.categorizeText('支付成功 ¥58 订单详情'), '支付票据');
  eq(SW.categorizeText('加入购物车，满减后到手价 129'), '购物比价');
  eq(SW.categorizeText('导航开始，全程约 12 公里'), '地图出行');
  eq(SW.categorizeText('复习笔记：知识点汇总'), '学习笔记');
  eq(SW.categorizeText('一段聊天记录 语音通话'), '聊天记录');
  eq(SW.categorizeText('随便什么文字'), '其他');
  eq(SW.categorizeText(''), '其他');
});
t('categorizeText 优先级：验证码压过支付', () => {
  eq(SW.categorizeText('支付成功页面上的验证码'), '时效垃圾');
});

// ---------- 抽样推算 ----------
t('analyzeSample 按比例推算全量', () => {
  const sample = [
    { category: '时效垃圾', size: 100 }, { category: '时效垃圾', size: 100 },
    { category: '聊天记录', size: 300 }, { category: '其他', size: 500 },
  ];
  const a = SW.analyzeSample(sample, 400, 100000);
  eq(a.sampleSize, 4);
  eq(a.estCounts['时效垃圾'], 200);
  eq(a.estCounts['聊天记录'], 100);
  eq(a.topCategory, '时效垃圾');
  eq(a.expiredBytes, 20000); // 样本字节占 20%
  eq(a.expiredShare, 0.5);
});
t('analyzeSample 空样本', () => {
  const a = SW.analyzeSample([], 100, 1000);
  eq(a.sampleSize, 0); eq(a.topCategory, '其他'); eq(a.expiredBytes, 0);
});
t('estimateReclaimable 相加', () => {
  const r = SW.estimateReclaimable({ wastedBytes: 700 }, { expiredBytes: 300 });
  eq(r.bytes, 1000); eq(r.dupBytes, 700); eq(r.expiredBytes, 300);
  eq(SW.estimateReclaimable(null, null).bytes, 0);
});
t('personaFor 阈值', () => {
  eq(SW.personaFor(0.5), '深夜截屏型选手');
  eq(SW.personaFor(0.2), '晚间灵感型选手');
  eq(SW.personaFor(0.05), '白天高效型选手');
});

// ---------- 年报卡与清单 ----------
t('buildCards 有识别结果出五张', () => {
  const stats = SW.computeStats([
    E('Screenshot_20261101-100000.png', 1000000, 2026, 11, 1, 10),
    E('Screenshot_20261102-233000.png', 2000000, 2026, 11, 2, 23),
  ]);
  const dup = SW.findDuplicates([]);
  const analysis = SW.analyzeSample([{ category: '购物比价', size: 100 }], stats.count, stats.totalBytes);
  const cards = SW.buildCards(stats, dup, analysis);
  eq(cards.length, 5);
  eq(cards.map((c) => c.id), ['total', 'month', 'night', 'content', 'clean']);
  eq(cards[0].big, '2 张');
  eq(cards[3].big, '购物比价');
});
t('buildCards 没识别时第四张是待识别，不编数', () => {
  const stats = SW.computeStats([E('Screenshot_20261101-100000.png', 1000, 2026, 11, 1, 10)]);
  const cards = SW.buildCards(stats, SW.findDuplicates([]), null);
  eq(cards[3].big, '待识别');
});
t('buildDeleteList 分区且不含保留张', () => {
  const entries = [
    { name: 'keep.png', size: 1, hash: '0000000000000000', lastModified: 1 },
    { name: 'dupe.png', size: 1, hash: '0000000000000000', lastModified: 2 },
    { name: 'code.png', size: 1, lastModified: 3 },
  ];
  const dup = SW.findDuplicates(entries);
  const txt = SW.buildDeleteList(entries, dup, ['其他', '其他', '时效垃圾']);
  ok(txt.includes('dupe.png'), '多余张应在清单里');
  ok(!txt.split('## 时效垃圾')[0].includes('keep.png'), '保留张不在重复区');
  ok(txt.includes('code.png'), '时效垃圾应在清单里');
  ok(txt.includes('只出清单，不替你删'), '要有免责声明行');
});
t('pickSample 大样本抽满且从最早开始', () => {
  const entries = [];
  for (let i = 0; i < 300; i++) entries.push(E('f' + i + '.png', 1, 2026, 1, 1 + (i % 28), 12));
  const s = SW.pickSample(entries, 60);
  eq(s.length, 60);
  eq(SW.pickSample(entries.slice(0, 10), 60).length, 10);
});

// ---------- HTML 结构 ----------
t('HTML 零静态外链依赖', () => {
  ok(!/<script[^>]+src=/.test(html), '不应有外链 script');
  ok(!/<link[^>]+href="http/.test(html), '不应有外链 CSS');
  ok(html.includes('<title>截图年报 ShotWrapped'), '标题不对');
});
t('HTML 关键控件都在', () => {
  for (const id of ['drop', 'fileInput', 'folderInput', 'demoBtn', 'ocrBtn', 'delBtn', 'cards', 'statTotal', 'statSize', 'statMonth', 'statNight', 'catBox', 'dupBox', 'status']) {
    ok(html.includes('id="' + id + '"'), '缺控件 #' + id);
  }
  ok(html.includes('webkitdirectory'), '文件夹选择要有 webkitdirectory');
});

console.log('ShotWrapped 自测：' + pass + ' 通过，' + fail + ' 失败');
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
