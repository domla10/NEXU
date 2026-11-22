-- Los vínculos académicos son independientes del rol global heredado.
-- Se conservan profiles.role y academic_role para preservar datos y compatibilidad;
-- solo el valor administrador concede autoridad global.

drop trigger validate_facilitator on public.course_facilitators;
drop trigger validate_participant on public.enrollments;
drop function nexu_private.validate_course_member_role();
drop trigger profiles_membership_role_guard on public.profiles;
drop function nexu_private.prevent_role_change_with_memberships();

create or replace function nexu_private.facilitates(target_course uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select nexu_private.is_verified() and exists (
    select 1 from public.course_facilitators f
    where f.course_id = target_course and f.facilitator_id = (select auth.uid()));
$$;

-- Bloquea la autorización del actor hasta el final de la transacción. Una
-- revocación concurrente espera a la operación o se observa antes de esta.
create function nexu_private.admin_write_allowed() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare allowed boolean;
begin
  if (select auth.uid()) is null or not nexu_private.is_verified() then return false; end if;
  select true into allowed from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'administrador'
    for share;
  return coalesce(allowed, false);
end;
$$;
revoke all on function nexu_private.admin_write_allowed() from public, anon, authenticated;
grant execute on function nexu_private.admin_write_allowed() to authenticated;

-- Las políticas de escritura toman el mismo bloqueo que el cambio de rol.
alter policy courses_admin_insert on public.courses with check (nexu_private.admin_write_allowed());
alter policy courses_admin_update on public.courses using (nexu_private.admin_write_allowed()) with check (nexu_private.admin_write_allowed());
alter policy courses_admin_delete on public.courses using (nexu_private.admin_write_allowed());
alter policy facilitators_admin_insert on public.course_facilitators with check (nexu_private.admin_write_allowed());
alter policy facilitators_admin_delete on public.course_facilitators using (nexu_private.admin_write_allowed());
alter policy enrollments_admin_insert on public.enrollments with check (nexu_private.admin_write_allowed());
alter policy enrollments_admin_delete on public.enrollments using (nexu_private.admin_write_allowed());

-- La única operación privilegiada para modificar el rol permanece en esquema
-- privado y comprueba identidad y autorización incluso si se invoca por SQL.
create function nexu_private.set_profile_role(target_id uuid, new_role public.academic_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not nexu_private.admin_write_allowed() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if target_id is null or new_role is null then raise exception 'Datos incompletos' using errcode = '22004'; end if;
  if target_id = (select auth.uid()) then raise exception 'No se permite cambiar el propio rol' using errcode = '42501'; end if;
  update public.profiles set role = new_role where id = target_id;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function nexu_private.set_profile_role(uuid,public.academic_role) from public, anon, authenticated;
grant execute on function nexu_private.set_profile_role(uuid,public.academic_role) to authenticated;

create or replace function public.set_profile_role(target_id uuid, new_role public.academic_role) returns void
language sql security invoker set search_path = '' as $$
  select nexu_private.set_profile_role(target_id, new_role);
$$;
revoke all on function public.set_profile_role(uuid,public.academic_role) from public, anon, authenticated;
grant execute on function public.set_profile_role(uuid,public.academic_role) to authenticated;
