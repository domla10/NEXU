-- SOLO NEXU-TEST, después de autorización expresa y con tres cuentas confirmadas.
-- Sustituir <ID_DE_EJECUCION> por el marcador hexadecimal producido por el ejecutor.
-- Sustituir <UUID_ADMIN_DE_PRUEBA> por el UUID mostrado por el mismo ejecutor.
-- No contiene contraseñas, claves ni identificadores de usuarios prefijados.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.profiles in exclusive mode;

do $test$
declare
  test_run text := '<ID_DE_EJECUCION>';
  expected_admin uuid := '<UUID_ADMIN_DE_PRUEBA>'::uuid;
  target_id uuid;
  verified_count integer;
  -- Exige autorización explícita y verificar las identidades independientemente de los metadatos.
  permitir_otros_admins_de_prueba boolean := false;
begin
  if test_run !~ '^[0-9a-f]{32}$' then raise exception 'Marcador de ejecución inválido'; end if;
  if exists (select 1 from public.profiles where role = 'administrador') then
    if not permitir_otros_admins_de_prueba or exists (
      select 1 from public.profiles p join auth.users u on u.id=p.id
      where p.role='administrador' and (
        coalesce(u.raw_user_meta_data->>'nexu_test_identity','') <> 'admin' or
        coalesce(u.raw_user_meta_data->>'nexu_test_run','') !~ '^[0-9a-f]{32}$'
      )
    ) then raise exception 'Existe un administrador: deténgase y revise antes de repetir'; end if;
  end if;
  if (select count(*) from auth.users where raw_user_meta_data->>'nexu_test_run'=test_run) <> 3 then
    raise exception 'Se requieren exactamente tres identidades para esta ejecución';
  end if;
  select count(*) into verified_count
  from auth.users u join public.profiles p on p.id = u.id
  where u.raw_user_meta_data->>'nexu_test_run' = test_run
    and u.email_confirmed_at is not null and p.role = 'participante'
    and u.raw_user_meta_data->>'nexu_test_identity' in ('admin','facilitador','participante');
  if verified_count <> 3 then raise exception 'Se requieren exactamente tres identidades confirmadas'; end if;
  if exists (
    select 1 from auth.users u where u.raw_user_meta_data->>'nexu_test_run' = test_run
    group by u.raw_user_meta_data->>'nexu_test_identity' having count(*) <> 1
  ) then raise exception 'Marcadores de identidad duplicados'; end if;
  select p.id into strict target_id from auth.users u join public.profiles p on p.id=u.id
  where u.raw_user_meta_data->>'nexu_test_run'=test_run
    and u.raw_user_meta_data->>'nexu_test_identity'='admin'
    and u.email_confirmed_at is not null and p.role='participante';
  if target_id <> expected_admin then raise exception 'UUID de administrador no coincide con el ejecutor'; end if;
  update public.profiles set role='administrador' where id=target_id;
end
$test$;
commit;
