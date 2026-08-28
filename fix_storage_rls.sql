-- 录音上传报 403「new row violates row-level security policy」：
-- lesson_audios 这个桶建好了，但 storage.objects 上没有放行 anon 的策略，
-- 所以老师一录音就上传失败（界面上以前误报成「请检查网络」）。

-- 1) 确保桶存在且公开（已经建过的话只把它设成 public）
insert into storage.buckets (id, name, public)
values ('lesson_audios', 'lesson_audios', true)
on conflict (id) do update set public = true;

-- 2) 放行读写。录音是教学素材，跟字库一样按公开处理；
--    登录入口本身有口令，这里不再做人的身份判断。
drop policy if exists lesson_audios_read   on storage.objects;
drop policy if exists lesson_audios_insert on storage.objects;
drop policy if exists lesson_audios_update on storage.objects;

create policy lesson_audios_read on storage.objects
  for select using (bucket_id = 'lesson_audios');

create policy lesson_audios_insert on storage.objects
  for insert with check (bucket_id = 'lesson_audios');

create policy lesson_audios_update on storage.objects
  for update using (bucket_id = 'lesson_audios')
  with check (bucket_id = 'lesson_audios');

-- 3) 顺手删掉我之前测权限留下的那条探针记录
delete from shared_audios where teacher_name = '__probe__';
