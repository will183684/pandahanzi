-- 共享音频表建好了，但 RLS 默认拦掉了 anon 的读写，
-- 所以老师录完音「保存成功」，共享库里其实一条都没写进去。
-- 这个脚本补上策略，并清掉建表时重复声明的那个唯一约束。

-- 1) 重复的唯一约束（建表时 unique(char_id, teacher_name) 写了两遍）
--    留一个就行，两个同名索引会让 upsert 的 on_conflict 不好解析。
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'shared_audios'::regclass and contype = 'u'
    offset 1
  loop
    execute format('alter table shared_audios drop constraint %I', c);
  end loop;
end $$;

-- 2) RLS 策略：字库是全局共享的教学资源，登录入口本身已经有口令，
--    这里跟 characters / lessons 一样按公开读写处理。
alter table shared_audios enable row level security;

drop policy if exists shared_audios_read   on shared_audios;
drop policy if exists shared_audios_write  on shared_audios;
drop policy if exists shared_audios_update on shared_audios;

create policy shared_audios_read   on shared_audios for select using (true);
create policy shared_audios_write  on shared_audios for insert with check (true);
create policy shared_audios_update on shared_audios for update using (true) with check (true);
