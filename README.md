# 熊猫画画班 · 汉字练习（多班级 + 共享课程库）

- **统一老师口令**登录（免注册）；进去后选/建自己的班级。
- **每个班独立**：自己的每周内容、学生名单、邀请码、进度，互不影响。
- **共享课程库**：老师可“从课程库选用”把某周内容拷进本班（拷贝一份，之后随便改），
  也可“存入课程库”贡献给别的班复用。
- 老师保存 → **Supabase Realtime 实时推送** → 家长端自动同步。
- 数据库 Supabase，前端 React + Vite，部署到 **Firebase Hosting**（Google Cloud）。

> 部署到 **Google Cloud Run** 看 `DEPLOY_CLOUD_RUN.md`（本文件下面的 Firebase 步骤是另一种可选托管）。
---

## 0. 准备
- Node.js 18+
- Supabase 账号（免费）：https://supabase.com
- Firebase / Google 账号（免费）：https://firebase.google.com

## 1. 建数据库（Supabase）
1. 新建 Supabase 项目。
2. **SQL Editor → New query**，粘贴 `supabase_schema.sql` 全文 → **Run**。
3. **Project Settings → API**，复制 `Project URL` 和 `anon public` key。

## 2. 本地配置 & 试跑
```bash
cp .env.example .env      # 填入上一步的 URL 和 anon key
npm install
npm run dev               # http://localhost:5173
```
试一遍：
- 「👩‍🏫 老师」→ 输入老师口令（默认 `panda@teacher`）→ **新建班级**（班名 + 邀请码）。
- 进班后在「内容设置」里填本周字 / 加学生 / 可“存入课程库”。
- 另开**无痕窗口**：「🏠 家长」→ 用该班邀请码 + 名字进入 → 验证老师改动会自动同步。

## 3. 打包
```bash
npm run build             # 产物在 dist/
```

## 4. 部署到 Firebase Hosting（Google Cloud）
```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # 填你的 Firebase Project ID
firebase deploy --only hosting
```
拿到 `https://你的项目.web.app` 发给客人即可。已带好 `firebase.json`（SPA 重写 + 缓存）。

> 重新部署只替换前端网页，**不会动 Supabase 里的数据**（班级 / 进度都保留）。

---

## 数据模型（都在一张 `kv` 表里，按 class_id 分区）
- `__root__` / `classes` → 班级清单 `[{id,name,invite_code}]`
- `__library__` / `index`、`lesson:xxx` → 共享课程库
- `cls_xxxx` / `weeks:index`、`week:*:meta`、`week:*:progress`、`student:*` → 某个班的数据

## 改这些地方
- **老师口令**：`src/App.jsx` 顶部 `const TEACHER_CODE = "panda@teacher"`，改成你要的。
- **班级邀请码**：在「老师 → 新建班级」时设置；进班后也能在「内容设置」改（会同步给家长）。

## 安全说明（重要）
- 现在是**匿名可读写**：老师口令 / 邀请码只在前端校验，拿到 anon key 的人能直接改库。
  适合私下发朋友测试，**不是生产级安全**。
- 要收紧：用 **Supabase Auth**（老师登录后才允许写），把 `kv_insert/kv_update` 策略改成
  基于 `auth` 的条件；学生写“进度”可单独放行（按 key 后缀）。需要的话可以再帮你做这版。

## 其它
- 「描一描（笔顺）」运行时从 `cdn.jsdelivr.net` 取笔顺数据；断网自动退回自由描红。
  托管平台若有 CSP，请放行 `script-src` / `connect-src` 的 `https://cdn.jsdelivr.net`。
- 改完代码记得 `npm run build` 再 `firebase deploy`。
