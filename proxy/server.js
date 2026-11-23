'use strict';

/**
 * AutoMate 共享代理（用于 Hugging Face Spaces / 任意 Node 容器）
 * - Key 只从环境变量读取，不落盘、不进前端
 * - 流式转发 DeepSeek
 * - 限制来源、单 IP 频率与每日总量，避免额度被刷
 */

const http = require('http');

const PORT = Number(process.env.PORT || 7860);
const HOST = '0.0.0.0';
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const API_BASE = String(process.env.DEEPSEEK_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODELS = new Set(['deepseek-chat', 'deepseek-reasoner', 'deepseek-flash']);
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'deepseek-chat';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://1055630875.github.io,http://127.0.0.1:8788,http://localhost:8788')
  .split(',').map(s => s.trim()).filter(Boolean);

const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 400);
const PER_IP_HOURLY = Number(process.env.PER_IP_HOURLY || 30);
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 2048);
const MAX_BODY = 8 * 1024 * 1024;
const MAX_MESSAGES = 40;

let dayKey = new Date().toISOString().slice(0, 10);
let dailyCount = 0;
const ipHits = new Map();

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function takeQuota(ip) {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dailyCount = 0;
    ipHits.clear();
  }
  if (dailyCount >= DAILY_LIMIT) {
    return { ok: false, retry: 3600, msg: '今日共享额度已用完，请明天再试。' };
  }
  const arr = (ipHits.get(ip) || []).filter(t => now - t < 3600 * 1000);
  if (arr.length >= PER_IP_HOURLY) {
    return { ok: false, retry: 600, msg: '请求太频繁，请稍后再试。' };
  }
  arr.push(now);
  ipHits.set(ip, arr);
  dailyCount += 1;
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (!v.some(t => now - t < 3600 * 1000)) ipHits.delete(k);
    }
  }
  return { ok: true };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function friendly(status, raw) {
  if (status === 401) return '服务端 API Key 无效，请联系维护者。';
  if (status === 402) return '服务端账户余额不足，请联系维护者。';
  if (status === 429) return '模型服务繁忙，请稍后再试。';
  if (status >= 500) return '模型服务暂时不可用。';
  try {
    const j = JSON.parse(raw);
    if (j && j.error && j.error.message) return '接口错误：' + j.error.message;
  } catch (e) {}
  return '接口请求失败（HTTP ' + status + '）。';
}

async function handleChat(req, res) {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json(res, 403, { error: { message: '来源未授权。' } });
  }

  const ip = clientIp(req);
  const quota = takeQuota(ip);
  if (!quota.ok) {
    res.setHeader('Retry-After', String(quota.retry));
    return json(res, 429, { error: { message: quota.msg } });
  }

  if (!API_KEY) {
    return json(res, 500, { error: { message: '服务端未配置 DEEPSEEK_API_KEY。' } });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req, MAX_BODY));
  } catch (e) {
    return json(res, 400, { error: { message: '请求格式错误：' + e.message } });
  }

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(res, 400, { error: { message: 'messages 不能为空。' } });
  }
  if (messages.length > MAX_MESSAGES) {
    return json(res, 400, { error: { message: '上下文过长，请新建对话。' } });
  }

  const model = MODELS.has(payload.model) ? payload.model : DEFAULT_MODEL;
  const temperature = Number.isFinite(Number(payload.temperature))
    ? Math.min(1.5, Math.max(0, Number(payload.temperature)))
    : 0.3;

  const body = {
    model,
    messages,
    stream: true,
    max_tokens: MAX_TOKENS
  };
  if (model !== 'deepseek-reasoner') body.temperature = temperature;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let closed = false;
  res.on('close', () => {
    closed = true;
    controller.abort();
  });

  let upstream;
  try {
    upstream = await fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (closed) return;
    return json(res, 504, { error: { message: '无法连接模型服务，请稍后再试。' } });
  }

  if (!upstream.ok) {
    clearTimeout(timer);
    const raw = await upstream.text().catch(() => '');
    return json(res, upstream.status, { error: { message: friendly(upstream.status, raw) } });
  }

  setCors(req, res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (closed || res.writableEnded) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    // 客户端或上游中断
  } finally {
    clearTimeout(timer);
    try { reader.cancel(); } catch (e) {}
    if (!res.writableEnded) res.end();
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      keySet: Boolean(API_KEY),
      model: DEFAULT_MODEL,
      limits: { perIpHour: PER_IP_HOURLY, daily: DAILY_LIMIT, maxTokens: MAX_TOKENS }
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    handleChat(req, res);
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('AutoMate proxy is running.\n');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
});

server.listen(PORT, HOST, () => {
  console.log('[AutoMate proxy] listening on ' + HOST + ':' + PORT);
  console.log('[AutoMate proxy] key ' + (API_KEY ? 'configured' : 'MISSING') +
    ' · daily ' + DAILY_LIMIT + ' · per-ip ' + PER_IP_HOURLY + '/h · max_tokens ' + MAX_TOKENS);
});
