# AutoMate · 自动化专业智能体（在线版）

面向自动化专业学生的助教型 AI 助手，部署在 GitHub Pages 上，打开网页即可对话。

在线地址（部署后）：

```text
https://1055630875.github.io/automate-chat/
```

## 这是什么

- 控制理论、过程控制、电力电子、电机拖动、传感器、PLC、嵌入式、机器人方向的答疑
- 流式输出、Markdown 渲染、表格、代码块（可复制）
- 公式用 MathJax 渲染（`$...$` / `$$...$$`）
- 内置「计算纪律」：先算后写、结果回代验算、结论与正文一致
- 模型可选 `deepseek-chat`（快）或 `deepseek-reasoner`（推理强、慢）
- 上下文默认 8 轮，可调 4 / 8 / 16 / 24
- 对话记录保存在本机浏览器，可导出 Markdown

## 第一次使用

GitHub Pages 是纯静态托管，没有服务器替你保管 API Key，所以：

1. 打开页面后，会弹出「连接 DeepSeek」；
2. 填入你自己的 DeepSeek API Key（`sk-...`）；
3. 点「保存」。

Key 只写入浏览器的 `localStorage`，不会上传到 GitHub 或任何第三方。换浏览器、清理站点数据、无痕模式都需要重新填写。

> 如果不想在网页里填 Key，用本地版：`D:\娱乐\automate-chat\启动.bat`，Key 存在服务端 `config.json`，浏览器完全不接触。

## 部署步骤（GitHub Desktop）

本地仓库已经初始化并提交好，只差发布。

1. 打开 **GitHub Desktop** → 菜单 **File → Add local repository…**
2. 选择本目录：`D:\娱乐\automate-chat-web`
3. 顶部会出现 **Publish repository**，点击：
   - Name：`automate-chat`
   - 取消勾选 **Keep this code private**（免费账号的 Pages 需要公开仓库）
   - 点 **Publish repository**
4. 打开 `https://github.com/1055630875/automate-chat` → **Settings → Pages**：
   - Source：**Deploy from a branch**
   - Branch：**main**
   - Folder：**/ (root)**
   - 点 **Save**
5. 等 1–2 分钟，访问：

```text
https://1055630875.github.io/automate-chat/
```

## 以后更新

改完 `index.html` 后，在 GitHub Desktop 里：

1. 左下角填 Summary，例如 `Update UI`
2. 点 **Commit to main**
3. 点 **Push origin**

Pages 会自动重新发布，通常 1 分钟内生效（可能需要 Ctrl+F5）。

## 文件

| 文件 | 说明 |
|---|---|
| `index.html` | 整个应用（HTML + CSS + JS 单文件） |
| `.nojekyll` | 关闭 Jekyll 处理，避免静态资源被忽略 |
| `README.md` | 本文件 |

## 安全注意

- **不要把 API Key 写进 `index.html`**。仓库是公开的，Key 写进去几分钟内就会被爬走。
- 页面里没有、也不应该有服务端密钥；Key 只存在访问者自己的浏览器里。
- 如果 Key 曾经泄露，去 DeepSeek 开放平台重置。
- 公式渲染依赖 `cdn.jsdelivr.net` 的 MathJax；CDN 加载失败时公式会显示为 LaTeX 源码，不影响正文。

## 与本地版的区别

| | 在线版（GitHub Pages） | 本地版（`automate-chat` + `启动.bat`） |
|---|---|---|
| 后端 | 无，浏览器直连 DeepSeek | Node 代理，Key 在服务端 |
| Key | 用户自己填，存 localStorage | 存在 `config.json`，浏览器看不到 |
| 打开方式 | 任意设备访问网址 | 本机 `http://127.0.0.1:8788` |
| 适合 | 分享给同学、手机访问 | 自己长期使用、不想暴露 Key |
