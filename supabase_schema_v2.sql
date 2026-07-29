-- ============================================================
-- 熊猫画画班 · Schema v2（课程库 + 班级排课 + 进度）
-- 运行位置：Supabase 控制台 -> SQL Editor -> New query -> Run
--
-- 本文件【只新增】表，不动现有的 kv 表。
--   继续留在 kv 的：班级名册 / 学生名册 / 老师名册（__root__）
--   迁到新表的：  字库、标准课程、班级排课、学生进度
--
-- 跑完本文件后，再跑 seed_curriculum.sql 导入 1200 字 / 240 课。
-- ============================================================

-- 通用：自动维护 updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ============================================================
-- A. 全局课程库（所有班共用；前端只读）
-- ============================================================

-- 字库：1200 字，global_seq 保持原字表顺序
create table if not exists public.characters (
  id         bigserial primary key,
  hanzi      text     not null unique,
  level      smallint not null check (level between 1 and 3),  -- 1=初级 2=中级 3=高级
  global_seq int      not null unique,                          -- 1..1200
  pinyin     text,                                              -- 自动生成，可改
  emoji      text                                               -- 可空，前端回退 ✨
);
create index if not exists characters_level_idx on public.characters(level, global_seq);

-- 标准课程：每 5 字一课，不跨级别
create table if not exists public.lessons (
  id        bigserial primary key,
  lesson_no int      not null unique,     -- 全局课号 1..240
  level     smallint not null check (level between 1 and 3),
  level_seq int      not null,            -- 该级别内第几课
  title     text,                         -- 留空则前端显示「第N课」
  vocab     text[]   not null default '{}',  -- 教务可预设词语，所有班共用
  sentence  text     not null default '',    -- 教务可预设句子
  unique (level, level_seq)
);
create index if not exists lessons_level_idx on public.lessons(level, level_seq);

-- 课 ↔ 字
create table if not exists public.lesson_chars (
  lesson_id bigint   not null references public.lessons(id) on delete cascade,
  char_id   bigint   not null references public.characters(id) on delete cascade,
  pos       smallint not null,
  primary key (lesson_id, char_id)
);
create index if not exists lesson_chars_lesson_idx on public.lesson_chars(lesson_id, pos);


-- ============================================================
-- B. 班级排课（每班独立，老师可写）
-- ============================================================

-- 老师「选用」某课 → 在这里生成一条，把字拷贝到 class_lesson_chars
create table if not exists public.class_lessons (
  id           bigserial primary key,
  class_id     text   not null,                             -- 沿用 kv 里的 cls_xxxx
  lesson_id    bigint references public.lessons(id),        -- 来源课；null = 老师完全自建
  seq          int    not null,                             -- 本班第几次课
  title        text   not null,
  vocab        text[] not null default '{}',
  sentence     text   not null default '',
  status       text   not null default 'active'
                 check (status in ('active', 'completed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (class_id, seq)
);
create index if not exists class_lessons_class_idx on public.class_lessons(class_id, seq desc);
create index if not exists class_lessons_lesson_idx on public.class_lessons(class_id, lesson_id);

-- 每个班同时最多只有一节「正在上」的课
create unique index if not exists class_lessons_one_active
  on public.class_lessons(class_id) where status = 'active';

drop trigger if exists class_lessons_touch on public.class_lessons;
create trigger class_lessons_touch before update on public.class_lessons
  for each row execute function public.touch_updated_at();


-- 本班这节课实际教的字（选课时从 lesson_chars 拷一份，之后老师随便增删改）
-- 故意不外键到 characters：老师可以加字表之外的任何字
create table if not exists public.class_lesson_chars (
  id              bigserial primary key,
  class_lesson_id bigint   not null references public.class_lessons(id) on delete cascade,
  hanzi           text     not null,
  pinyin          text,
  emoji           text,
  audio_url       text,                                    -- 老师录音（现为 data URL）
  pos             smallint not null,
  updated_at      timestamptz not null default now(),
  unique (class_lesson_id, hanzi)
);
create index if not exists class_lesson_chars_lesson_idx
  on public.class_lesson_chars(class_lesson_id, pos);

drop trigger if exists class_lesson_chars_touch on public.class_lesson_chars;
create trigger class_lesson_chars_touch before update on public.class_lesson_chars
  for each row execute function public.touch_updated_at();


-- 进度：每个学生 / 每节课 / 每个活动一行，历史永久保留
create table if not exists public.lesson_progress (
  class_lesson_id bigint not null references public.class_lessons(id) on delete cascade,
  student_name    text   not null,
  activity_key    text   not null,                          -- 'flash'|'find'|'trace'|'build'
  completed_at    timestamptz not null default now(),
  primary key (class_lesson_id, student_name, activity_key)
);
create index if not exists lesson_progress_lesson_idx
  on public.lesson_progress(class_lesson_id, student_name);


-- ============================================================
-- C. RLS
-- ⚠️ 与现有 kv 一致：没有 Supabase Auth，口令只在前端校验。
--    课程库设为「前端只读」，避免误改字库；班级数据放开读写。
--    以后接入 Auth 时在这里收紧。
-- ============================================================

alter table public.characters         enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_chars       enable row level security;
alter table public.class_lessons      enable row level security;
alter table public.class_lesson_chars enable row level security;
alter table public.lesson_progress    enable row level security;

-- 课程库：只读（lessons 额外允许改 vocab/sentence/title，给教务预设用）
drop policy if exists "characters_read"   on public.characters;
create policy "characters_read"   on public.characters   for select using (true);

drop policy if exists "lessons_read"      on public.lessons;
drop policy if exists "lessons_update"    on public.lessons;
create policy "lessons_read"      on public.lessons      for select using (true);
create policy "lessons_update"    on public.lessons      for update using (true) with check (true);

drop policy if exists "lesson_chars_read" on public.lesson_chars;
create policy "lesson_chars_read" on public.lesson_chars for select using (true);

-- 班级数据：全放开（与 kv 现状一致）
do $$
declare t text;
begin
  foreach t in array array['class_lessons', 'class_lesson_chars', 'lesson_progress'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read',   t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using (true)',                  t || '_read',   t);
    execute format('create policy %I on public.%I for insert with check (true)',             t || '_insert', t);
    execute format('create policy %I on public.%I for update using (true) with check (true)', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (true)',                  t || '_delete', t);
  end loop;
end $$;


-- ============================================================
-- D. Realtime（老师保存 → 家长端自动刷新）
--    只订阅会变的三张表；课程库是静态的，不需要。
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['class_lessons', 'class_lesson_chars', 'lesson_progress'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ============================================================
-- E. 清掉旧的 week 数据（可选）
--    你确认过旧数据不用留。班级/学生/老师名册在 __root__，不会被删。
--    确认无误后取消注释再跑。
-- ============================================================
-- delete from public.kv
--  where class_id like 'cls_%'
--    and (key like 'week:%' or key in ('weeks:index', 'weeks:current'));


-- ============================================================
-- 建表自检
-- ============================================================
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;
