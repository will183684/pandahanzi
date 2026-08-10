-- ============================================================
-- 迁移：字库分级 3 级 -> 12 级
--
-- 字的先后顺序、拼音、课程划分、词语句子全部不变，只重新标 level。
-- 逐字比对确认过：12 级 = 现有 1200 字按 40/50/60/70/80/90/100/110/
-- 120/130/150/200 切分，L3 吸收补的 8 个字（吃糖茶猪鹅帽裤冰）。
-- 总课数仍是 120，一节课都不用重排。
--
-- 运行：Supabase SQL Editor 跑一次。可重复执行。
-- ============================================================

begin;

-- 1) 放开 1..3 的约束
alter table public.characters drop constraint if exists characters_level_check;
alter table public.lessons    drop constraint if exists lessons_level_check;

-- 2) lessons 的 (level, level_seq) 唯一约束会挡住整体重排，先摘掉
alter table public.lessons drop constraint if exists lessons_level_level_seq_key;

-- 3) 字库分级
update public.characters set level = 1 where global_seq between 1 and 40;   -- L1 启蒙起步 (40字)
update public.characters set level = 2 where global_seq between 41 and 90;   -- L2 基础入门 (50字)
update public.characters set level = 3 where global_seq between 91 and 150;   -- L3 启蒙进阶 (60字)
update public.characters set level = 4 where global_seq between 151 and 220;   -- L4 生活初阶 (70字)
update public.characters set level = 5 where global_seq between 221 and 300;   -- L5 生活常用 (80字)
update public.characters set level = 6 where global_seq between 301 and 390;   -- L6 场景拓展 (90字)
update public.characters set level = 7 where global_seq between 391 and 490;   -- L7 认知扩容 (100字)
update public.characters set level = 8 where global_seq between 491 and 600;   -- L8 读写基础 (110字)
update public.characters set level = 9 where global_seq between 601 and 720;   -- L9 进阶提升 (120字)
update public.characters set level = 10 where global_seq between 721 and 850;   -- L10 读写进阶 (130字)
update public.characters set level = 11 where global_seq between 851 and 1000;   -- L11 高阶巩固 (150字)
update public.characters set level = 12 where global_seq between 1001 and 1200;   -- L12 高阶收官 (200字)

-- 4) 课程分级 + 级内序号
update public.lessons set level = 1, level_seq = lesson_no - 0 where lesson_no between 1 and 4;   -- L1 启蒙起步 (4课)
update public.lessons set level = 2, level_seq = lesson_no - 4 where lesson_no between 5 and 9;   -- L2 基础入门 (5课)
update public.lessons set level = 3, level_seq = lesson_no - 9 where lesson_no between 10 and 15;   -- L3 启蒙进阶 (6课)
update public.lessons set level = 4, level_seq = lesson_no - 15 where lesson_no between 16 and 22;   -- L4 生活初阶 (7课)
update public.lessons set level = 5, level_seq = lesson_no - 22 where lesson_no between 23 and 30;   -- L5 生活常用 (8课)
update public.lessons set level = 6, level_seq = lesson_no - 30 where lesson_no between 31 and 39;   -- L6 场景拓展 (9课)
update public.lessons set level = 7, level_seq = lesson_no - 39 where lesson_no between 40 and 49;   -- L7 认知扩容 (10课)
update public.lessons set level = 8, level_seq = lesson_no - 49 where lesson_no between 50 and 60;   -- L8 读写基础 (11课)
update public.lessons set level = 9, level_seq = lesson_no - 60 where lesson_no between 61 and 72;   -- L9 进阶提升 (12课)
update public.lessons set level = 10, level_seq = lesson_no - 72 where lesson_no between 73 and 85;   -- L10 读写进阶 (13课)
update public.lessons set level = 11, level_seq = lesson_no - 85 where lesson_no between 86 and 100;   -- L11 高阶巩固 (15课)
update public.lessons set level = 12, level_seq = lesson_no - 100 where lesson_no between 101 and 120;   -- L12 高阶收官 (20课)

-- 5) 约束加回来（放宽到 12 级）
alter table public.characters add constraint characters_level_check check (level between 1 and 12);
alter table public.lessons    add constraint lessons_level_check    check (level between 1 and 12);
alter table public.lessons    add constraint lessons_level_level_seq_key unique (level, level_seq);

commit;

-- ---------- 自检（应与下表完全一致）----------
-- select level, count(*) from public.characters group by level order by level;
--   L1 = 40
--   L2 = 50
--   L3 = 60
--   L4 = 70
--   L5 = 80
--   L6 = 90
--   L7 = 100
--   L8 = 110
--   L9 = 120
--   L10 = 130
--   L11 = 150
--   L12 = 200
--
-- select level, count(*), min(level_seq), max(level_seq) from public.lessons group by level order by level;
--   L1 = 4 课，级内序号 1..4
--   L2 = 5 课，级内序号 1..5
--   L3 = 6 课，级内序号 1..6
--   L4 = 7 课，级内序号 1..7
--   L5 = 8 课，级内序号 1..8
--   L6 = 9 课，级内序号 1..9
--   L7 = 10 课，级内序号 1..10
--   L8 = 11 课，级内序号 1..11
--   L9 = 12 课，级内序号 1..12
--   L10 = 13 课，级内序号 1..13
--   L11 = 15 课，级内序号 1..15
--   L12 = 20 课，级内序号 1..20
--
-- 校验没有漏网：
-- select count(*) from public.characters where level is null or level not between 1 and 12;   -- 0
-- select count(*) from public.lessons where level is null or level not between 1 and 12;      -- 0
