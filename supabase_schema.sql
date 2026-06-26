-- ============================================================
-- 熊猫画画班 · Supabase schema（多班级 + 共享课程库）
-- 运行位置：Supabase 控制台 -> SQL Editor -> New query -> Run
-- ============================================================

-- 一张按“班级”分区的键值表。
--   class_id = "__root__"     存班级清单（registry）：key="classes"
--   class_id = "__library__"  存共享课程库：key="index" / "lesson:xxx"
--   class_id = "cls_xxxx"     存某个班的数据：
--       weeks:index / weeks:current
--       week:week_001:meta / week:week_001:progress
--       student:小明
create table if not exists public.kv (
  class_id   text not null,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (class_id, key)
);

alter table public.kv enable row level security;

-- ⚠️ 开放策略：拿到网址 + anon key 的人都能读写。
-- 老师口令、班级邀请码都是在前端校验的（不是真安全），适合“私下发朋友测试”。
-- 要正式上线请改用 Supabase Auth 收紧写权限（见 README）。
drop policy if exists "kv_read"   on public.kv;
drop policy if exists "kv_insert" on public.kv;
drop policy if exists "kv_update" on public.kv;
drop policy if exists "kv_delete" on public.kv;

create policy "kv_read"   on public.kv for select using (true);
create policy "kv_insert" on public.kv for insert with check (true);
create policy "kv_update" on public.kv for update using (true) with check (true);
create policy "kv_delete" on public.kv for delete using (true);

-- 实时同步：老师保存后，家长端自动刷新
alter publication supabase_realtime add table public.kv;
