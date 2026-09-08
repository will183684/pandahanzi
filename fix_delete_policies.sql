-- 三处都只放行了读/写/更新，没有 DELETE，结果是：
--   · 测试留下的记录清不掉
--   · Storage 里没人引用的旧录音删不掉
-- 补上删除权限。app 本身不会调删除，这几条只是为了能做清理。

-- 1) 整词录音
drop policy if exists shared_word_audios_delete on shared_word_audios;
create policy shared_word_audios_delete on shared_word_audios for delete using (true);

-- 2) 单字录音
drop policy if exists shared_audios_delete on shared_audios;
create policy shared_audios_delete on shared_audios for delete using (true);

-- 3) 录音文件
drop policy if exists lesson_audios_delete on storage.objects;
create policy lesson_audios_delete on storage.objects
  for delete using (bucket_id = 'lesson_audios');

-- 4) 顺手清掉我测试时留下的那条
delete from shared_word_audios where word = '__探针__';
