-- VÉRTICE · migración 002 (ejecutar DESPUÉS de schema.sql): administración, documentos, equipo de cliente.
create function public.is_client_admin(ws uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from workspace_members m join workspaces w on w.id=m.workspace_id where m.user_id=auth.uid() and m.workspace_id=ws and w.kind='client' and m.role='admin')$$;
create function public.shares_admin_ws(p uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from workspace_members m where m.user_id=p and public.is_client_admin(m.workspace_id))$$;
create policy mem_client_admin on public.workspace_members for select to authenticated using(public.is_client_admin(workspace_id));
create policy prof_client_admin on public.profiles for select to authenticated using(public.shares_admin_ws(id));

create function public.create_client(n text) returns uuid language plpgsql security definer set search_path=public as $$
declare i uuid;begin
 if not public.is_internal_admin() then raise exception 'Sin permiso';end if;
 insert into workspaces(name,kind) values(n,'client') returning id into i;return i;end$$;
create function public.add_member(ws uuid,mail text,r text) returns void language plpgsql security definer set search_path=public as $$
declare u uuid;k text;begin
 select kind into k from workspaces where id=ws;
 if k is null or not(public.is_internal_admin() or (k='client' and public.is_client_admin(ws))) then raise exception 'Sin permiso';end if;
 if r not in('admin','member') then raise exception 'Rol no válido';end if;
 select id into u from auth.users where lower(email)=lower(mail);
 if u is null then raise exception 'No se pudo añadir el usuario. Debe estar invitado antes en Authentication > Users.';end if;
 insert into workspace_members(workspace_id,user_id,role) values(ws,u,r) on conflict(workspace_id,user_id) do update set role=excluded.role;end$$;
revoke execute on function public.create_client(text),public.add_member(uuid,text,text) from public,anon;
grant execute on function public.create_client(text),public.add_member(uuid,text,text) to authenticated;

-- Almacenamiento privado de documentos: ruta <workspace_id>/<archivo>
insert into storage.buckets(id,name,public) values('documentos','documentos',false) on conflict do nothing;
create policy doc_internal on storage.objects for all to authenticated using(bucket_id='documentos' and public.is_internal()) with check(bucket_id='documentos' and public.is_internal());
create policy doc_client on storage.objects for select to authenticated using(bucket_id='documentos' and exists(select 1 from public.client_reports r where r.file_path=name and r.published and public.is_client_member(r.workspace_id)));

-- Registro honesto de integraciones: ninguna está implementada todavía.
insert into public.integrations(name,status,notes) values
('Envío de correo','futura','Requiere configuración y autorización explícita; no hay envíos automáticos.'),
('Calendario','futura','Sin implementar.'),
('Fuentes de datos de empresas','futura','Solo fuentes cuya licencia permita su uso comercial.');
