-- Base de datos de NEXU: sin datos de ejemplo ni credenciales.
-- Las funciones privadas evitan consultas recursivas entre políticas RLS.
create schema nexu_private;
revoke all on schema nexu_private from public, anon, authenticated;
grant usage on schema nexu_private to authenticated;

create type public.academic_role as enum ('participante', 'facilitador', 'administrador');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Nombre pendiente'
    check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120 and full_name !~ '[[:cntrl:]]'),
  role public.academic_role not null default 'participante',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 200 and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.course_facilitators (
  course_id uuid not null references public.courses(id) on delete cascade,
  facilitator_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (course_id, facilitator_id)
);
create index course_facilitators_facilitator_idx on public.course_facilitators(facilitator_id, course_id);
create table public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (course_id, participant_id)
);
create index enrollments_participant_idx on public.enrollments(participant_id, course_id);

-- Auditoría mínima: no guarda nombres, correos, credenciales ni JWT.
create table nexu_private.admin_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  entity_id uuid,
  related_id uuid,
  old_role public.academic_role,
  new_role public.academic_role
);
alter table nexu_private.admin_audit enable row level security;
revoke all on all tables in schema nexu_private from public, anon, authenticated;
revoke all on all sequences in schema nexu_private from public, anon, authenticated;

create function nexu_private.is_verified() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from auth.users u
    where u.id = (select auth.uid()) and u.email is not null and u.email_confirmed_at is not null);
$$;
create function nexu_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select nexu_private.is_verified() and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'administrador');
$$;
create function nexu_private.facilitates(target_course uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select nexu_private.is_verified() and exists (
    select 1 from public.course_facilitators f
    join public.profiles p on p.id = f.facilitator_id
    where f.course_id = target_course and f.facilitator_id = (select auth.uid())
      and p.role = 'facilitador');
$$;
create function nexu_private.enrolled_in(target_course uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select nexu_private.is_verified() and exists (
    select 1 from public.enrollments e where e.course_id = target_course
      and e.participant_id = (select auth.uid()));
$$;
create function nexu_private.can_read_profile(target_profile uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select nexu_private.is_verified() and (
    target_profile = (select auth.uid()) or nexu_private.is_admin() or exists (
      select 1 from public.enrollments e
      where e.participant_id = target_profile and nexu_private.facilitates(e.course_id)));
$$;

create function nexu_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function nexu_private.touch_updated_at();
create trigger courses_touch before update on public.courses for each row execute function nexu_private.touch_updated_at();

-- El nombre es contenido no confiable; el rol siempre se fija en el servidor.
create function nexu_private.create_profile_for_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare safe_name text;
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'full_name') = 'string' then
    safe_name := left(btrim(regexp_replace(new.raw_user_meta_data ->> 'full_name', '[[:cntrl:]]', '', 'g')), 120);
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(nullif(safe_name, ''), 'Nombre pendiente'), 'participante');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function nexu_private.create_profile_for_auth_user();

-- Solo se asignan usuarios con el rol correspondiente al crear relaciones.
create function nexu_private.validate_course_member_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare member_role public.academic_role;
begin
  if not nexu_private.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if tg_table_name = 'course_facilitators' then
    select p.role into member_role from public.profiles p where p.id = new.facilitator_id for share;
    if member_role is distinct from 'facilitador'::public.academic_role then
      raise exception 'La asignación requiere un facilitador';
    end if;
  else
    select p.role into member_role from public.profiles p where p.id = new.participant_id for share;
    if member_role is distinct from 'participante'::public.academic_role then
      raise exception 'La inscripción requiere un participante';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_facilitator before insert or update on public.course_facilitators
  for each row execute function nexu_private.validate_course_member_role();
create trigger validate_participant before insert or update on public.enrollments
  for each row execute function nexu_private.validate_course_member_role();

create function nexu_private.audit_admin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item record; entity uuid; related uuid; previous_role public.academic_role; next_role public.academic_role;
begin
  if tg_table_name = 'profiles' then
    if old.role is not distinct from new.role then return new; end if;
    entity := new.id; previous_role := old.role; next_role := new.role;
  else
    if tg_op = 'DELETE' then item := old; else item := new; end if;
    if tg_table_name = 'courses' then entity := item.id;
    elsif tg_table_name = 'course_facilitators' then entity := item.course_id; related := item.facilitator_id;
    else entity := item.course_id; related := item.participant_id; end if;
  end if;
  insert into nexu_private.admin_audit(actor_id, action, entity_id, related_id, old_role, new_role)
  values ((select auth.uid()), tg_table_name || '.' || lower(tg_op), entity, related, previous_role, next_role);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger audit_profile_role after update of role on public.profiles for each row execute function nexu_private.audit_admin_change();
create trigger audit_courses after insert or update or delete on public.courses for each row execute function nexu_private.audit_admin_change();
create trigger audit_facilitators after insert or update or delete on public.course_facilitators for each row execute function nexu_private.audit_admin_change();
create trigger audit_enrollments after insert or update or delete on public.enrollments for each row execute function nexu_private.audit_admin_change();

-- Evita que asignaciones antiguas recuperen privilegios tras un cambio de rol.
create function nexu_private.prevent_role_change_with_memberships() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role is distinct from new.role and (
    exists (select 1 from public.course_facilitators f where f.facilitator_id = old.id) or
    exists (select 1 from public.enrollments e where e.participant_id = old.id)
  ) then
    raise exception 'Retire primero las asignaciones e inscripciones del perfil' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger profiles_membership_role_guard before update of role on public.profiles
  for each row execute function nexu_private.prevent_role_change_with_memberships();

-- Única vía para que un administrador autenticado cambie roles por la API.
create function public.set_profile_role(target_id uuid, new_role public.academic_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not nexu_private.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if target_id is null or new_role is null then raise exception 'Datos incompletos' using errcode = '22004'; end if;
  if target_id = (select auth.uid()) then raise exception 'No se permite cambiar el propio rol' using errcode = '42501'; end if;
  update public.profiles set role = new_role where id = target_id;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_facilitators enable row level security;
alter table public.enrollments enable row level security;

revoke all on public.profiles, public.courses, public.course_facilitators, public.enrollments from public, anon, authenticated;
grant select on public.profiles, public.courses, public.course_facilitators, public.enrollments to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert (name), update (name), delete on public.courses to authenticated;
grant insert (course_id, facilitator_id), delete on public.course_facilitators to authenticated;
grant insert (course_id, participant_id), delete on public.enrollments to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (nexu_private.can_read_profile(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (nexu_private.is_verified() and id = (select auth.uid()))
  with check (nexu_private.is_verified() and id = (select auth.uid()));
create policy courses_read on public.courses for select to authenticated
  using (nexu_private.is_admin() or nexu_private.facilitates(id) or nexu_private.enrolled_in(id));
create policy courses_admin_insert on public.courses for insert to authenticated with check (nexu_private.is_admin());
create policy courses_admin_update on public.courses for update to authenticated using (nexu_private.is_admin()) with check (nexu_private.is_admin());
create policy courses_admin_delete on public.courses for delete to authenticated using (nexu_private.is_admin());
create policy facilitators_read on public.course_facilitators for select to authenticated
  using (nexu_private.is_admin() or (nexu_private.is_verified() and facilitator_id = (select auth.uid())));
create policy facilitators_admin_insert on public.course_facilitators for insert to authenticated with check (nexu_private.is_admin());
create policy facilitators_admin_delete on public.course_facilitators for delete to authenticated using (nexu_private.is_admin());
create policy enrollments_read on public.enrollments for select to authenticated
  using (nexu_private.is_admin() or nexu_private.facilitates(course_id) or (nexu_private.is_verified() and participant_id = (select auth.uid())));
create policy enrollments_admin_insert on public.enrollments for insert to authenticated with check (nexu_private.is_admin());
create policy enrollments_admin_delete on public.enrollments for delete to authenticated using (nexu_private.is_admin());

-- PostgreSQL concede EXECUTE a PUBLIC por defecto; restringir cada función.
revoke execute on all functions in schema nexu_private from public, anon, authenticated;
grant execute on function nexu_private.is_verified(), nexu_private.is_admin(), nexu_private.facilitates(uuid), nexu_private.enrolled_in(uuid), nexu_private.can_read_profile(uuid) to authenticated;
revoke all on function public.set_profile_role(uuid, public.academic_role) from public, anon, authenticated;
grant execute on function public.set_profile_role(uuid, public.academic_role) to authenticated;
