# 共享代理部署（访客无需填写 Key）

GitHub Pages 只能放静态文件，无法保存 Key。要让「别人打开就能用」，需要把 Key 放到一个小代理服务里：

```text
GitHub Pages（界面）  →  https://xxx.hf.space（代理，持有 Key）  →  api.deepseek.com
```

本目录的 `proxy/` 就是代理源码，可部署到 Hugging Face Spaces（免费、无需信用卡），也可以放到任意 Node 容器 / 云服务器。

## 一、创建 Hugging Face Space

1. 打开 <https://huggingface.co>，注册或登录（邮箱即可，免费）。
2. 右上角头像 → **New Space**。
3. 填写：
   - Space name：`automate-proxy`
   - License：随便选（如 MIT）
   - SDK：**Docker**
   - Docker template：**Blank**
   - Space hardware：**CPU basic · 2 vCPU · 16 GB · FREE**
   - Visibility：**Public**
4. 点 **Create Space**。

## 二、上传代理文件

进入 Space 的 **Files** 标签，把 `proxy/` 里的三个文件拖进去：

```text
README.md
Dockerfile
server.js
```

注意：是这三个文件放在 Space 根目录，不是 `proxy/` 文件夹本身。

## 三、配置 Key（Secret）

Space 页面 → **Settings** → **Variables and secrets** → **New secret**：

```text
Name:  DEEPSEEK_API_KEY
Value: sk-你的key
```

保存。Key 只存在 Space 服务端，不会出现在网页或仓库里。

## 四、等待构建

Space 会自动构建，大约 2–5 分钟。状态变成 **Running** 后，页面上的 App 会显示聊天框（代理本身只返回一行文字，正常）。

你的代理地址是：

```text
https://<你的HF用户名>-automate-proxy.hf.space
```

浏览器打开 `https://<用户名>-automate-proxy.hf.space/api/health`，能看到：

```json
{"ok":true,"keySet":true,...}
```

就说明 Key 配好了。

## 五、让网页用上代理

回到 GitHub 仓库 `1055630875/automate-chat`，编辑根目录的 `config.json`：

```json
{
  "apiBase": "https://<你的HF用户名>-automate-proxy.hf.space"
}
```

提交后等 1 分钟，打开 <https://1055630875.github.io/automate-chat/>，会发现：

- 不再弹「填写 Key」
- 左下角显示「共享代理 · 无需 Key」
- 任何人打开都能直接对话

## 六、额度与安全

代理默认限制：

| 限制 | 默认值 | 改法 |
|---|---|---|
| 单 IP 每小时 | 30 次 | Space 变量 `PER_IP_HOURLY` |
| 全站每天 | 400 次 | Space 变量 `DAILY_LIMIT` |
| 单次回答 | 2048 token | Space 变量 `MAX_TOKENS` |

这些都是公开服务，链接被转发后可能被陌生人使用。如果发现额度消耗异常：

1. 把 `DAILY_LIMIT` 调小（改完自动重启）；
2. 到 DeepSeek 平台重置 Key，再更新 Space 的 Secret；
3. 必要时把 Space 设为 Private（但这样网页也调不通了）。

## 七、如果 Hugging Face 打不开

代理代码是标准 Node，可换任意能跑 Docker/Node 的平台：

- 腾讯云 EdgeOne Pages / 云函数（国内访问最好）
- ModelScope 创空间（国内，需阿里账号）
- 自己的服务器 + `node server.js`（`PORT` 环境变量）

换平台后只需要改 `config.json` 里的 `apiBase`，网页不用动。
