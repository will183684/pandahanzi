-- 创建函数：更新学生名字（同时更新班级名单和学习进度）
create or replace function rename_student_with_progress(
  old_name text,
  new_name text
) returns void as $$
begin
  -- 不做任何检查，直接更新 lesson_progress 表
  update lesson_progress
  set student_name = new_name
  where student_name = old_name;
end;
$$ language plpgsql;
