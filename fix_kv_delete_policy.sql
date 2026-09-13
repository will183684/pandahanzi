-- kv 表没有 DELETE 策略，于是删除被 RLS 静默拦下：删 0 行，HTTP 还是 204，
-- 看起来完全成功。「彻底删除学生」时头像那条（key = profile:名字）就是这么
-- 一直留在库里的。
--
-- 补上删除权限。app 只在彻底删除学生时用它。
drop policy if exists kv_delete on kv;
create policy kv_delete on kv for delete using (true);

-- 顺手清掉我测试时留下的两条
delete from kv where key in ('profile:ZZprobe', 'profile:ZZ测试生');
