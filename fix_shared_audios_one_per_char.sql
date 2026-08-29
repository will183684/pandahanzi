-- 录音改成「一个字一条，全局共用，最后录的人覆盖前面的」。
-- 原来是 unique(char_id, teacher_name) —— 每个老师各存一条，读的时候
-- 挑最新的。结果同一个字在库里堆好几份，谁覆盖谁全看 created_at，不直观。

-- 1) 同一个字只留最新的一条
delete from shared_audios a
using shared_audios b
where a.char_id = b.char_id
  and (a.created_at < b.created_at
       or (a.created_at = b.created_at and a.id < b.id));

-- 2) 换成「一个字一条」
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'shared_audios'::regclass and contype = 'u'
  loop
    execute format('alter table shared_audios drop constraint %I', c);
  end loop;
end $$;

alter table shared_audios add constraint shared_audios_char_id_key unique (char_id);

-- 3) 记一下最后是谁录的、什么时候录的，界面上要显示
alter table shared_audios
  alter column updated_at set default now();
