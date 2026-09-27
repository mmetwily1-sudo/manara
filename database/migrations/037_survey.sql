-- 037: نوع استبيان للفيدباك (لماذا اخترتنا)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'feedback'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    begin
      execute format('alter table feedback drop constraint %I', r.conname);
    exception when others then null;
    end;
  end loop;
  alter table feedback
    add constraint feedback_kind_check
    check (kind in ('nps','idea','bug','praise','survey'));
end $$;
