/**
 * 飞书多维表格岗位数据抓取脚本
 * ───────────────────────────────────────────
 * 用途：定时拉取飞书多维表格中的秋招岗位数据，生成静态 JSON 供前端消费
 *
 * 认证方式：飞书 OAuth v3（user_access_token + refresh_token）
 *   - 刷新端点：https://accounts.feishu.cn/oauth/v3/token
 *   - refresh_token 有过期时间（通常 30 天），刷新后会返回新的 refresh_token
 *
 * 输出文件（写入 client/public/data/）：
 *   - jobs.json         全量岗位
 *   - daily-jobs.json   北京时间当日更新的岗位
 *
 * 环境变量（全部必填，禁止硬编码）：
 *   FEISHU_APP_ID           飞书应用 App ID
 *   FEISHU_APP_SECRET       飞书应用 App Secret
 *   FEISHU_REFRESH_TOKEN    当前有效的 refresh_token
 *   FEISHU_APP_TOKEN        多维表格所属应用的 app_token（bitable app token）
 *   FEISHU_TABLE_ID         多维表格 table_id
 *
 * 用法：
 *   node scripts/fetchFeishuJobs.js
 *   npm run fetch:jobs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  环境变量校验
// ═══════════════════════════════════════════

const REQUIRED_ENV = [
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_REFRESH_TOKEN',
  'FEISHU_APP_TOKEN',
  'FEISHU_TABLE_ID',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ 缺少必要的环境变量: ${missing.join(', ')}`);
  console.error('   请确保以上变量已配置在环境变量或 .env 文件中');
  process.exit(1);
}

const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_REFRESH_TOKEN,
  FEISHU_APP_TOKEN,
  FEISHU_TABLE_ID,
} = process.env;

// ═══════════════════════════════════════════
//  常量
// ═══════════════════════════════════════════

const OAUTH_BASE = 'accounts.feishu.cn';
const OAUTH_PATH = '/oauth/v3/token';
const BITABLE_BASE = 'open.feishu.cn';
const BITABLE_PATH = `/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`;

const PAGE_SIZE = 500; // 飞书单页最大 500
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'public', 'data');
const REFRESH_TOKEN_FILE = path.join(__dirname, '..', '.refresh_token');

// ═══════════════════════════════════════════
//  HTTP 请求封装（原生 https，零依赖）
// ═══════════════════════════════════════════

/**
 * 发送 HTTPS 请求
 * @param {string} hostname
 * @param {string} path
 * @param {'GET'|'POST'} method
 * @param {Record<string,string>} headers
 * @param {object|null} body  POST 请求体（JSON）
 * @returns {Promise<{status: number, data: object}>}
 */
function request(hostname, path, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          reject(new Error(`响应非 JSON (HTTP ${res.statusCode}): ${raw.slice(0, 200)}`));
          return;
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时 (30s)')); });
    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ═══════════════════════════════════════════
//  1. 刷新 user_access_token（OAuth v3）
// ═══════════════════════════════════════════

/**
 * 通过 refresh_token 刷新 user_access_token
 * 文档：https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authentication-v1/refresh-access-token
 *
 * @returns {Promise<{access_token: string, refresh_token: string}>}
 */
async function refreshToken() {
  console.log('🔐 正在刷新 user_access_token ...');

  let result;
  try {
    result = await request(OAUTH_BASE, OAUTH_PATH, 'POST', {}, {
      grant_type: 'refresh_token',
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      refresh_token: FEISHU_REFRESH_TOKEN,
    });
  } catch (err) {
    console.error(`❌ Token 刷新请求失败: ${err.message}`);
    process.exit(1);
  }

  const { status, data } = result;

  if (status !== 200 || data.code !== 0) {
    const msg = data.msg || data.error_description || `HTTP ${status}`;
    console.error(`❌ Token 刷新失败: ${msg}`);
    console.error(`   响应详情: ${JSON.stringify(data)}`);
    process.exit(1);
  }

  const accessToken = data.data?.access_token || data.access_token;
  const newRefreshToken = data.data?.refresh_token || data.refresh_token;

  if (!accessToken) {
    console.error(`❌ Token 刷新响应中未找到 access_token: ${JSON.stringify(data)}`);
    process.exit(1);
  }

  console.log('✅ user_access_token 刷新成功');

  // 保存新的 refresh_token（下次运行时使用）
  if (newRefreshToken && newRefreshToken !== FEISHU_REFRESH_TOKEN) {
    try {
      fs.writeFileSync(REFRESH_TOKEN_FILE, newRefreshToken, 'utf8');
      console.log('🔄 检测到新的 refresh_token，已保存到 .refresh_token 文件');
      console.log('   ⚠️  请及时更新 GitHub Secrets 中的 FEISHU_REFRESH_TOKEN，否则过期后抓取会失败');
    } catch (err) {
      console.warn(`⚠️  保存新 refresh_token 失败: ${err.message}`);
      console.warn(`   新 refresh_token 值: ${newRefreshToken}`);
    }
  }

  return { access_token: accessToken, refresh_token: newRefreshToken || FEISHU_REFRESH_TOKEN };
}

// ═══════════════════════════════════════════
//  2. 分页拉取多维表格全部记录
// ═══════════════════════════════════════════

/**
 * 分页拉取飞书多维表格全部记录
 * @param {string} token user_access_token
 * @returns {Promise<Array<{record_id: string, fields: object, last_modified_time: number}>>}
 */
async function fetchAllRecords(token) {
  console.log('📥 开始分页拉取多维表格记录 ...');

  const allItems = [];
  let pageToken = '';
  let pageCount = 0;

  while (true) {
    pageCount++;
    const params = [`page_size=${PAGE_SIZE}`];
    if (pageToken) params.push(`page_token=${encodeURIComponent(pageToken)}`);

    const queryPath = BITABLE_PATH + '?' + params.join('&');

    let result;
    try {
      result = await request(BITABLE_BASE, queryPath, 'GET', {
        Authorization: `Bearer ${token}`,
      });
    } catch (err) {
      console.error(`❌ 第 ${pageCount} 页请求失败: ${err.message}`);
      process.exit(1);
    }

    const { status, data } = result;

    if (status !== 200 || data.code !== 0) {
      console.error(`❌ 第 ${pageCount} 页拉取失败: ${data.msg || `HTTP ${status}`}`);
      console.error(`   响应详情: ${JSON.stringify(data).slice(0, 500)}`);
      process.exit(1);
    }

    const items = data.data?.items || [];
    allItems.push(...items);
    console.log(`   第 ${pageCount} 页: ${items.length} 条 (累计 ${allItems.length})`);

    if (!data.data?.has_more) break;
    pageToken = data.data?.page_token || '';
    if (!pageToken) break;
  }

  console.log(`✅ 全量拉取完成，共 ${allItems.length} 条记录`);
  return allItems;
}

// ═══════════════════════════════════════════
//  3. 筛选北京时间当日更新的记录
// ═══════════════════════════════════════════

/**
 * 获取北京时间（UTC+8）当日的时间范围
 * @returns {{todayStart: number, todayEnd: number}}
 */
function getBeijingTodayRange() {
  const now = new Date();
  // UTC+8 当日 00:00:00.000
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -8, 0, 0, 0);
  // UTC+8 当日 23:59:59.999
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
  return { todayStart, todayEnd };
}

/**
 * 筛选 last_modified_time 在北京时间当日范围内的记录
 * @param {Array} records
 * @returns {Array}
 */
function filterToday(records) {
  const { todayStart, todayEnd } = getBeijingTodayRange();
  const startDate = new Date(todayStart);
  const endDate = new Date(todayEnd);

  console.log(`📅 北京时间今日范围: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);
  console.log(`   (时间戳: ${todayStart} ~ ${todayEnd})`);

  const todayList = records.filter(item => {
    const t = item.last_modified_time;
    if (t == null) return false;
    // last_modified_time 是毫秒时间戳，直接做数值比较
    const ts = typeof t === 'string' ? Number(t) : t;
    if (Number.isNaN(ts)) return false;
    return ts >= todayStart && ts <= todayEnd;
  });

  console.log(`✅ 当日更新记录: ${todayList.length} 条`);
  return todayList;
}

// ═══════════════════════════════════════════
//  4. 扁平化 & 写入 JSON 文件
// ═══════════════════════════════════════════

/**
 * 扁平化记录：{ record_id, ...fields }
 * @param {Array} records
 * @returns {Array}
 */
function flattenRecords(records) {
  return records.map(item => ({
    record_id: item.record_id,
    last_modified_time: item.last_modified_time,
    ...(item.fields || {}),
  }));
}

/**
 * 写入 JSON 文件，自动创建目录
 * @param {string} filename
 * @param {Array} data
 */
function writeJson(filename, data) {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  } catch (err) {
    console.error(`❌ 创建输出目录失败: ${OUTPUT_DIR} — ${err.message}`);
    process.exit(1);
  }

  const filePath = path.join(OUTPUT_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📄 已写入: ${filePath} (${data.length} 条)`);
  } catch (err) {
    console.error(`❌ 写入文件失败: ${filePath} — ${err.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════
//  主流程
// ═══════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🚀 飞书多维表格岗位数据抓取           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`   启动时间: ${new Date().toISOString()}`);
  console.log(`   App ID: ${FEISHU_APP_ID.slice(0, 6)}***`);
  console.log(`   App Token: ${FEISHU_APP_TOKEN.slice(0, 6)}***`);
  console.log(`   Table ID: ${FEISHU_TABLE_ID}`);
  console.log('');

  try {
    // 1. 刷新 token
    const { access_token: token } = await refreshToken();

    // 2. 拉取全量记录
    const allRecords = await fetchAllRecords(token);

    if (allRecords.length === 0) {
      console.warn('⚠️  多维表格中没有记录，仅写入空数组');
    }

    // 3. 筛选当日更新
    const todayRecords = filterToday(allRecords);

    // 4. 扁平化 & 写入
    const flatAll = flattenRecords(allRecords);
    const flatToday = flattenRecords(todayRecords);

    writeJson('jobs.json', flatAll);
    writeJson('daily-jobs.json', flatToday);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 抓取完成 (耗时 ${elapsed}s)`);
    console.log(`   全量岗位: ${flatAll.length} 条 → jobs.json`);
    console.log(`   当日更新: ${flatToday.length} 条 → daily-jobs.json`);
  } catch (err) {
    console.error(`\n💥 未捕获异常: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
