# 部署到 Google Cloud Run + 连 Supabase

## 前提
- 装好 gcloud CLI 并登录：`gcloud init`（选好你的 GCP 项目）
- 已在 Supabase 跑过 `supabase_schema.sql`，并拿到 `Project URL` + `anon public` key

## 一次性：开启所需服务
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 1. 写入 Supabase 配置（构建时用）
```bash
cp .env.production.example .env.production   # 填入 URL 和 anon key
```
> ⚠️ Vite 是**构建时**把这两个值打进前端的，运行时设环境变量无效。anon key 本就是公开的，放进去没问题。

## 2. 部署（一条命令，用本目录的 Dockerfile 构建）
```bash
gcloud run deploy panda-hanzi \
  --source . \
  --region us-central1 \
  --port 8080 \
  --allow-unauthenticated
```
完成后会输出一个 `https://panda-hanzi-xxxx-uc.a.run.app` 网址，发给客人即可。

## 更新版本
改完代码后，重复第 2 步即可滚动更新。**Supabase 里的班级/进度数据不受影响**（部署只换前端容器）。

---

## 不想把 key 写进文件？（用构建参数替代 .env.production）
在 Dockerfile 的 `RUN npm run build` 前加：
```dockerfile
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
```
然后本地构建并推送、再部署镜像：
```bash
PROJECT=$(gcloud config get-value project)
gcloud builds submit --tag gcr.io/$PROJECT/panda-hanzi \
  --substitutions _URL="https://xxx.supabase.co",_KEY="anon-key"   # 需要在 cloudbuild 里映射为 --build-arg
# 或本地 docker：
# docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... -t gcr.io/$PROJECT/panda-hanzi .
# docker push gcr.io/$PROJECT/panda-hanzi
gcloud run deploy panda-hanzi --image gcr.io/$PROJECT/panda-hanzi --region us-central1 --port 8080 --allow-unauthenticated
```
（最省事的还是 `.env.production` + `--source .`。）

## Supabase 那边要注意
- 浏览器直接连 Supabase（请求来自用户浏览器，不是 Cloud Run），**不需要**配 Cloud Run 出口 IP。
- Supabase 默认允许任意来源用 anon key 访问 REST/Realtime，无需额外 CORS 设置。
- 确认 `supabase_schema.sql` 里的 `alter publication supabase_realtime add table public.kv;` 已执行，实时同步才生效。

## 老师口令 / 安全
- `src/App.jsx` 顶部：`TEACHER_CODE`（授课老师）、`ADMIN_CODE`（教务老师），改成你要的。
- 现在数据库是匿名可读写（口令前端校验），适合测试，不是生产级；正式要收紧用 Supabase Auth。
