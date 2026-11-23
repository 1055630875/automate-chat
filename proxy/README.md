---
title: AutoMate Proxy
emoji: 🤖
colorFrom: indigo
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# AutoMate 共享代理

为 `https://1055630875.github.io/automate-chat/` 提供 DeepSeek 转发，访客无需填写 Key。

## 必须配置的 Secret

在 Space 的 **Settings → Variables and secrets** 里添加：

```text
DEEPSEEK_API_KEY = sk-你的key
```

类型选 **Secret**。不要写进代码或 README。

## 可选变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://1055630875.github.io,http://127.0.0.1:8788,http://localhost:8788` | 允许的网页来源，逗号分隔 |
| `DAILY_LIMIT` | `400` | 全站每日请求上限 |
| `PER_IP_HOURLY` | `30` | 单个 IP 每小时上限 |
| `MAX_TOKENS` | `2048` | 单次回答最大 token |
| `DEFAULT_MODEL` | `deepseek-chat` | 默认模型 |

## 接口

- `GET /api/health` → 健康检查
- `POST /api/chat` → `{ messages, model, temperature }`，返回 SSE 流

## 说明

- 这是公开服务，额度可能被陌生人消耗；已内置单 IP 限流和每日总量，必要时把 `DAILY_LIMIT` 调小。
- Key 只存在 Space 的 Secret 中，不会出现在前端或日志里。
