#!/usr/bin/env node
/**
 * 飞书多维表格 Puppeteer 抓取脚本
 *
 * 策略：
 *   1. 从 FEISHU_COOKIE 环境变量解析登录态 Cookie
 *   2. 无头浏览器打开多维表格页面
 *   3. 拦截飞书 Bitable API 响应，提取 records JSON
 *   4. 规范化字段名 → 写入 client/public/job-list.json
 *
 * Cookie 获取方式（浏览器 DevTools）：
 *   打开 https://ycnynolbv7lx.feishu.cn/base/M7p6bYxFWa3GcXscQ1HcHaAWnod
 *   → F12 → Network → 任意 XHR 请求 → Request Headers → Cookie → 全选复制
 *
 * Cookie 配置位置：GitHub 仓库 → Settings → Secrets → Actions → FEISHU_COOKIE
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ── 环境变量 ──
const FEISHU_URL =
  process.env.FEISHU_URL ||
  'https://ycnynolbv7lx.feishu.cn/base/M7p6bYxFWa3GcXscQ1HcHaAWnod';
const FEISHU_COOKIE = process.env.FEISHU_COOKIE || '';
const OUTPUT = path.resolve(__dirname, '../../client/public/job-list.json');

// ── Cookie 解析 ──
function parseCookies(cookieString) {
  /** 格式 A: JSON 数组 */
  if (cookieString.trim().startsWith('[')) {
    try {
      return JSON.parse(cookieString);
    } catch { /* fall through */ }
  }

  /** 格式 B: 标准 Cookie 字符串 name1=val1; name2=val2 */
  return cookieString
    .split(';')
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;
      return {
        name: pair.slice(0, idx).trim(),
        value: pair.slice(idx + 1).trim(),
        domain: '.feishu.cn',
        path: '/',
        httpOnly: false,
        secure: true,
      };
    })
    .filter(Boolean);
}

// ── 从 API 响应中提取岗位数据 ──
function extractJobsFromApi(responses) {
  for (const { url, data } of responses) {
    // 只处理 bitable records 接口
    if (!url.includes('bitable') && !url.includes('records')) continue;

    // 尝试多种响应结构
    const items =
      data?.data?.items ||    // Feishu Open API: { data: { items: [...] } }
      data?.items ||           // 简化格式
      data?.data?.records ||   // 部分内部 API
      data?.records ||
      null;

    if (!items || !Array.isArray(items) || items.length === 0) continue;

    // 检查是否包含 fields（飞书多维表格标准格式）
    const sample = items[0];
    if (sample && typeof sample === 'object' && sample.fields) {
      const jobs = items.map((item, i) => normalizeRecord(item.fields, i));
      console.log(`  ✅ 从 ${url} 提取到 ${jobs.length} 条记录`);
      return jobs;
    }

    // 可能是扁平化的记录
    if (sample && typeof sample === 'object' && !sample.fields) {
      const jobs = items.map((item, i) => normalizeRecord(item, i));
      console.log(`  ✅ 从 ${url} 提取到 ${jobs.length} 条扁平记录`);
      return jobs;
    }
  }
  return null;
}

// ── 字段名规范化 ──
/**
 * 将飞书多维表格的中文字段映射到标准 ExternalJob 结构。
 * 根据实际表格列名调整 FIELD_MAP 中的中文键。
 */
const FIELD_MAP = {
  company:     ['公司', '企业名称', '公司名称', 'company', '企业'],
  position:    ['岗位', '职位', '职位名称', '岗位名称', 'position', 'title'],
  city:        ['城市', '工作城市', '工作地点', '地点', 'city', 'location'],
  jobType:     ['类型', '招聘类型', '岗位类型', 'jobType', 'type', '工作性质'],
  salary:      ['薪资', '薪资范围', '薪酬', 'salary', '待遇'],
  description: ['描述', '职位描述', '岗位描述', 'description', 'desc', 'JD'],
  requirements:['要求', '任职要求', '岗位要求', 'requirements', 'requirement'],
  deadline:    ['截止日期', '投递截止', 'deadline', 'end_date', 'due_date'],
  link:        ['链接', '投递链接', '申请链接', 'link', 'url', 'apply_url'],
  postedAt:    ['发布时间', '发布日期', 'postedAt', 'posted_at', 'publish_date'],
};

function getField(fields, key) {
  const aliases = FIELD_MAP[key] || [key];
  for (const alias of aliases) {
    if (fields[alias] !== undefined && fields[alias] !== null && fields[alias] !== '') {
      return fields[alias];
    }
  }
  return '';
}

function normalizeRecord(fields, index) {
  const rawType = String(getField(fields, 'jobType') || '校招');
  const jobType = rawType.includes('实习') || rawType.toLowerCase().includes('intern')
    ? 'internship'
    : rawType.includes('社招') || rawType.includes('全职') || rawType.toLowerCase().includes('fulltime')
      ? 'fulltime'
      : 'campus';

  // 尝试保留飞书记录 ID
  const recordId =
    fields.record_id || fields.id || fields._id || fields['记录ID'] || '';

  return {
    id: recordId ? `feishu_${recordId}` : `feishu_${index}_${Date.now()}`,
    company:      String(getField(fields, 'company')),
    position:     String(getField(fields, 'position')),
    city:         String(getField(fields, 'city')),
    jobType,
    salary:       String(getField(fields, 'salary')),
    description:  String(getField(fields, 'description')),
    requirements: String(getField(fields, 'requirements')),
    deadline:     String(getField(fields, 'deadline')),
    link:         String(getField(fields, 'link')),
    postedAt:     String(getField(fields, 'postedAt')),
    source:       'feishu_bitable',
    isSaved:      false,
  };
}

// ── DOM 兜底提取 ──
async function extractJobsFromDOM(page) {
  return page.evaluate(() => {
    const results = [];

    // 策略 1: 查找飞书多维表格的隐藏结构化数据
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      // 飞书有时将初始数据内嵌在 <script> 中
      if (text.length < 200) continue;

      // 尝试匹配 records JSON
      const recMatch = text.match(/"records"\s*:\s*(\[[^\]]*\{[^}]*"fields"[^}]*\}[^\]]*\])/);
      if (recMatch) {
        try {
          const records = JSON.parse(recMatch[1]);
          for (const r of records) {
            if (r.fields) results.push(r.fields);
          }
          if (results.length > 0) return results;
        } catch { /* continue */ }
      }
    }

    // 策略 2: 尝试解析表格 DOM（部分旧版或无障碍渲染）
    const grid = document.querySelector('[role="grid"], .table-view, table');
    if (!grid) return results;

    const rows = grid.querySelectorAll('[role="row"], tr');
    if (rows.length < 2) return results;

    // 第一行作为表头
    const headers = [];
    const headerCells = rows[0].querySelectorAll('[role="columnheader"], th, [class*="header"]');
    headerCells.forEach(c => headers.push((c.textContent || '').trim()));

    // 数据行
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('[role="cell"], td');
      const record = {};
      cells.forEach((cell, j) => {
        if (headers[j]) record[headers[j]] = (cell.textContent || '').trim();
      });
      if (Object.keys(record).length > 0) results.push(record);
    }

    return results;
  });
}

// ── 主流程 ──
async function main() {
  console.log('=== 飞书多维表格抓取开始 ===\n');

  // 0. 验证环境
  if (!FEISHU_COOKIE) {
    console.error('❌ 未配置 FEISHU_COOKIE 环境变量');
    console.error('   请在 GitHub Secrets 中添加 FEISHU_COOKIE');
    process.exit(1);
  }

  const cookies = parseCookies(FEISHU_COOKIE);
  console.log(`🍪 解析到 ${cookies.length} 个 Cookie`);
  console.log(`🌐 目标 URL: ${FEISHU_URL}\n`);

  // 1. 启动浏览器
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  // 设置超时
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(30000);

  // 2. 注入 Cookie
  await page.setCookie(...cookies);

  // 3. 设置响应拦截（在导航之前）
  /** @type {Array<{url: string, data: object}>} */
  const apiResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    // 只关注 bitable 相关 API
    if (!url.includes('bitable') && !url.includes('records')) return;

    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;

      const json = await response.json();
      apiResponses.push({ url, data: json });
      console.log(`  📡 拦截响应: ${url.substring(0, 100)}...`);
    } catch {
      // 非 JSON 或解析失败，忽略
    }
  });

  // 4. 导航到多维表格页面
  console.log('⏳ 正在加载飞书多维表格...');
  try {
    await page.goto(FEISHU_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (err) {
    console.error(`⚠️ 页面加载超时: ${err.message}`);
    // 即使超时也继续，可能数据已加载
  }

  // 5. 等待数据加载（额外的等待时间，确保 API 请求完成）
  console.log('⏳ 等待数据加载 (15s)...');
  await new Promise((r) => setTimeout(r, 15000));

  // 检查是否被重定向到登录页（Cookie 过期）
  const currentUrl = page.url();
  if (currentUrl.includes('accounts.feishu.cn') || currentUrl.includes('login')) {
    console.error('❌ Cookie 已过期，页面重定向到飞书登录页');
    console.error('   请重新获取 Cookie 并更新 FEISHU_COOKIE Secret');
    await browser.close();
    process.exit(1);
  }

  console.log(`  📄 当前页面: ${currentUrl.substring(0, 80)}...`);
  console.log(`  📦 拦截到 ${apiResponses.length} 个 API 响应\n`);

  // 6. 从 API 响应提取数据
  let jobs = extractJobsFromApi(apiResponses);

  // 7. API 兜底 → DOM 提取
  if (!jobs || jobs.length === 0) {
    console.log('⚠️ API 拦截未提取到数据，尝试 DOM 提取...');
    const domFields = await extractJobsFromDOM(page);
    if (domFields && domFields.length > 0) {
      jobs = domFields.map((fields, i) => normalizeRecord(fields, i));
      console.log(`  ✅ DOM 提取到 ${jobs.length} 条记录`);
    }
  }

  // 8. 输出结果
  if (!jobs || jobs.length === 0) {
    console.error('\n❌ 未能提取到任何岗位数据');
    console.error('   排查建议：');
    console.error('   1. 检查 FEISHU_COOKIE 是否过期（飞书 Cookie 通常 1-7 天过期）');
    console.error('   2. 确认账号有该多维表格的查看权限');
    console.error('   3. 确认表格列名在 FIELD_MAP 中有对应的中文映射');
    await browser.close();
    process.exit(1);
  }

  // 9. 写入文件
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(jobs, null, 2), 'utf-8');

  // 统计
  const companies = new Set(jobs.map((j) => j.company)).size;
  const cities = new Set(jobs.map((j) => j.city).filter(Boolean)).size;

  console.log(`\n=== 抓取完成 ===`);
  console.log(`  📊 岗位总数: ${jobs.length}`);
  console.log(`  🏢 公司数:   ${companies}`);
  console.log(`  📍 城市数:   ${cities}`);
  console.log(`  💾 输出文件: ${OUTPUT}\n`);

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 脚本异常:', err);
  process.exit(1);
});
