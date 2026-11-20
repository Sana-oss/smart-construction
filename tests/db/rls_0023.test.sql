-- Tests for the calculator coefficient (migration 0023; FR-MAT-04). Uses Owner One (...a1) from rls_0006.test.sql.
-- Global reference data: signed-in users read it; nobody outside a migration writes it; anonymous visitors see nothing.
reset role;

-- 1. One unreviewed coefficient, readable by a signed-in user
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from calc_coefficients where key = 'rebar_kg_per_m_divisor' and value = 162
                 and status = 'unreviewed' and reviewed_by is null and reviewed_on is null) then
    raise exception 'FAIL: expected one unreviewed rebar coefficient';
  end if;
  raise notice 'OK: the rebar coefficient is readable and unreviewed';
end $$;

-- 2. A signed-in user cannot add, change, approve or delete it
do $$ begin
  insert into calc_coefficients (key, value, unit, source) values ('rebar_kg_per_m_divisor', 100, 'x', 'me');
  raise exception 'LEAK: user inserted a coefficient';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot add a coefficient'; end $$;
do $$ begin
  update calc_coefficients set value = 100;
  raise exception 'LEAK: user changed the coefficient';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot change the coefficient'; end $$;
do $$ begin
  update calc_coefficients set status = 'approved', reviewed_by = 'me', reviewed_on = current_date;
  raise exception 'LEAK: user approved the coefficient';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot approve the coefficient'; end $$;
do $$ begin
  delete from calc_coefficients;
  raise exception 'LEAK: user deleted the coefficient';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot delete the coefficient'; end $$;

-- 3. An anonymous visitor reads nothing
reset role;
set role anon;
set app.uid = '';
do $$ begin
  if exists (select 1 from calc_coefficients) then raise exception 'LEAK: anonymous visitor read the coefficient'; end if;
  raise notice 'OK: anonymous visitor reads no coefficient';
exception when insufficient_privilege then raise notice 'OK: anonymous visitor reads no coefficient';
end $$;

-- 4. The table's own rules (as the migration owner, past RLS)
reset role;
do $$ begin
  insert into calc_coefficients (key, value, unit, source) values ('waste_pct', 5, '%', 'x');
  raise exception 'FAIL: an unknown key was accepted';
exception when check_violation then raise notice 'OK: only known keys';
end $$;
do $$ begin
  update calc_coefficients set value = 0;
  raise exception 'FAIL: a zero coefficient was accepted';
exception when check_violation then raise notice 'OK: the coefficient is positive';
end $$;
do $$ begin
  update calc_coefficients set status = 'approved';
  raise exception 'FAIL: approved without a named reviewer';
exception when check_violation then raise notice 'OK: approval needs a reviewer and a date';
end $$;
