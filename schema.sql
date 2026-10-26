-- VÉRTICE · esquema, RLS y vistas del portal. Ejecutar en Supabase > SQL Editor.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text,created_at timestamptz not null default now());
create table public.workspaces(id uuid primary key default gen_random_uuid(),name text not null,kind text not null check(kind in('internal','client')),created_at timestamptz not null default now());
create unique index one_internal_ws on public.workspaces(kind) where kind='internal';
create table public.workspace_members(workspace_id uuid not null references public.workspaces on delete cascade,user_id uuid not null references auth.users on delete cascade,role text not null check(role in('admin','member')),created_at timestamptz not null default now(),primary key(workspace_id,user_id));
create table public.companies(id uuid primary key default gen_random_uuid(),name text not null,sector text,website text,source text,
 status text not null default 'pendiente_contactar' check(status in('pendiente_contactar','contactada','propuesta_enviada','negociando','aceptada','rechazada','cliente_activo','inactiva')),
 owner_id uuid references auth.users,client_workspace_id uuid references public.workspaces,internal_notes text,rejection_reason text,is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.opportunities(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,title text not null,priority int not null default 3 check(priority between 1 and 5),score int,score_reason text,status text not null default 'abierta' check(status in('abierta','en_curso','ganada','perdida')),next_action text,due_date date,created_at timestamptz not null default now());
create table public.analyses(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,summary text,internal_notes text,created_at timestamptz not null default now());
create table public.proposals(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,title text not null,status text not null default 'borrador' check(status in('borrador','enviada','aceptada','rechazada')),sent_at timestamptz,created_at timestamptz not null default now());
create table public.activities(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,kind text not null default 'otro' check(kind in('analisis','contacto','respuesta','reunion','conversion','otro')),title text not null,detail text,shared boolean not null default false,occurred_at timestamptz not null default now(),created_by uuid default auth.uid(),created_at timestamptz not null default now());
create table public.tasks(id uuid primary key default gen_random_uuid(),company_id uuid references public.companies on delete cascade,title text not null,due_date date,done boolean not null default false,assigned_to uuid references auth.users,created_at timestamptz not null default now());
create table public.scoring_rules(id uuid primary key default gen_random_uuid(),name text not null,criterion text not null,weight int not null default 1,active boolean not null default true,created_at timestamptz not null default now());
create table public.services(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,name text not null,status text not null default 'activo',started_at date,created_at timestamptz not null default now());
create table public.client_reports(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces on delete cascade,company_id uuid references public.companies,title text not null,file_path text,published boolean not null default false,published_at timestamptz,created_at timestamptz not null default now());
create table public.integrations(id uuid primary key default gen_random_uuid(),name text not null,status text not null default 'futura' check(status in('futura','requiere_configuracion','activa')),notes text,created_at timestamptz not null default now());

create function public.touch() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger companies_touch before update on public.companies for each row execute function public.touch();
create function public.new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name') on conflict do nothing;return new;end$$;
create trigger on_auth_user after insert on auth.users for each row execute function public.new_user();

-- Funciones de pertenencia (servidor). Un cliente solo se reconoce por su pertenencia a un workspace 'client'.
create function public.is_internal() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from workspace_members m join workspaces w on w.id=m.workspace_id where m.user_id=auth.uid() and w.kind='internal')$$;
create function public.is_internal_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from workspace_members m join workspaces w on w.id=m.workspace_id where m.user_id=auth.uid() and w.kind='internal' and m.role='admin')$$;
create function public.is_client_member(ws uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from workspace_members m join workspaces w on w.id=m.workspace_id where m.user_id=auth.uid() and m.workspace_id=ws and w.kind='client')$$;

-- RLS: todo cerrado por defecto; anon sin acceso.
do $$declare t text;begin
 foreach t in array array['profiles','workspaces','workspace_members','companies','opportunities','analyses','proposals','activities','tasks','scoring_rules','services','client_reports','integrations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);end loop;
 -- tablas puramente internas: cualquier miembro interno
 foreach t in array array['companies','opportunities','analyses','proposals','activities','tasks','services'] loop
  execute format('create policy internal_all on public.%I for all to authenticated using(public.is_internal()) with check(public.is_internal())',t);end loop;
 -- configuración: lectura interna, escritura solo administrador interno
 foreach t in array array['scoring_rules','integrations'] loop
  execute format('create policy internal_read on public.%I for select to authenticated using(public.is_internal())',t);
  execute format('create policy admin_write on public.%I for all to authenticated using(public.is_internal_admin()) with check(public.is_internal_admin())',t);end loop;
end$$;
create policy own_or_internal on public.profiles for select to authenticated using(id=auth.uid() or public.is_internal());
create policy own_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy ws_read on public.workspaces for select to authenticated using(public.is_internal() or public.is_client_member(id));
create policy ws_admin on public.workspaces for all to authenticated using(public.is_internal_admin()) with check(public.is_internal_admin());
create policy mem_read on public.workspace_members for select to authenticated using(user_id=auth.uid() or public.is_internal());
create policy mem_admin on public.workspace_members for all to authenticated using(public.is_internal_admin()) with check(public.is_internal_admin());
create policy rep_internal on public.client_reports for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy rep_client on public.client_reports for select to authenticated using(published and public.is_client_member(workspace_id));

-- Portal: vistas con columnas explícitas. Solo actividades marcadas como compartidas de la propia empresa.
create view public.portal_activity as select a.id,c.client_workspace_id as workspace_id,a.kind,a.title,a.detail,a.occurred_at from activities a join companies c on c.id=a.company_id where a.shared and public.is_client_member(c.client_workspace_id);
create view public.portal_metrics as select c.client_workspace_id as workspace_id,a.kind,count(*)::int as total from activities a join companies c on c.id=a.company_id where a.shared and public.is_client_member(c.client_workspace_id) group by 1,2;
revoke all on public.portal_activity,public.portal_metrics from anon;
grant select on public.portal_activity,public.portal_metrics to authenticated;

-- Arranque (ejecutar UNA vez, sustituyendo el correo del primer administrador):
-- 1) crea el usuario en Authentication > Users; 2) ejecuta:
-- with w as (insert into workspaces(name,kind) values('VÉRTICE','internal') returning id)
-- insert into workspace_members(workspace_id,user_id,role) select w.id,u.id,'admin' from w,auth.users u where u.email='TU_CORREO';
-- Alta de un cliente: insertar workspace kind='client', añadir sus usuarios en workspace_members y poner companies.client_workspace_id.
