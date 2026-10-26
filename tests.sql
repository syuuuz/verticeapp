-- Pruebas de aislamiento. Ejecutar en el SQL Editor: usa una transacción y termina con ROLLBACK (no deja datos).
begin;
select set_config('t.a',gen_random_uuid()::text,true),set_config('t.b',gen_random_uuid()::text,true),set_config('t.i',gen_random_uuid()::text,true),
 set_config('t.wa',gen_random_uuid()::text,true),set_config('t.wb',gen_random_uuid()::text,true),set_config('t.wi',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) select current_setting('t.'||k)::uuid,k||'@test.local','authenticated','authenticated' from unnest(array['a','b','i']) k;
insert into workspaces(id,name,kind) values(current_setting('t.wa')::uuid,'A','client'),(current_setting('t.wb')::uuid,'B','client'),(current_setting('t.wi')::uuid,'INT','internal');
insert into workspace_members values(current_setting('t.wa')::uuid,current_setting('t.a')::uuid,'member'),(current_setting('t.wb')::uuid,current_setting('t.b')::uuid,'member'),(current_setting('t.wi')::uuid,current_setting('t.i')::uuid,'admin');
insert into companies(id,name,client_workspace_id) values('00000000-0000-0000-0000-00000000000a','EmpA',current_setting('t.wa')::uuid),('00000000-0000-0000-0000-00000000000b','EmpB',current_setting('t.wb')::uuid);
insert into activities(company_id,title,shared) values('00000000-0000-0000-0000-00000000000a','A compartida',true),('00000000-0000-0000-0000-00000000000a','A interna',false),('00000000-0000-0000-0000-00000000000b','B compartida',true);
insert into client_reports(workspace_id,title,published) values(current_setting('t.wb')::uuid,'B informe',true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('t.a'),'role','authenticated')::text,true);
do $$declare n int;begin
 select count(*) into n from workspaces; if n<>1 then raise exception 'FALLO: A ve % workspaces',n;end if;
 select count(*) into n from companies; if n<>0 then raise exception 'FALLO: A ve empresas';end if;
 select count(*) into n from activities; if n<>0 then raise exception 'FALLO: A lee activities';end if;
 select count(*) into n from portal_activity; if n<>1 then raise exception 'FALLO: portal_activity de A = %',n;end if;
 select count(*) into n from client_reports; if n<>0 then raise exception 'FALLO: A ve informes de B';end if;
 begin insert into activities(company_id,title) values('00000000-0000-0000-0000-00000000000a','x'); raise exception 'FALLO: A inserta actividad';exception when insufficient_privilege or others then if sqlerrm like 'FALLO%' then raise;end if;end;
 begin perform create_client('x'); raise exception 'FALLO: A crea cliente';exception when others then if sqlerrm like 'FALLO%' then raise;end if;end;
 raise notice 'OK: aislamiento del cliente A';end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('t.i'),'role','authenticated')::text,true);
do $$declare n int;begin select count(*) into n from companies; if n<>2 then raise exception 'FALLO: interno ve % empresas',n;end if; raise notice 'OK: acceso interno';end$$;
rollback;
