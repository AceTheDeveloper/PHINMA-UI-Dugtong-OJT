-- Platform admin functions and audit triggers for school settings and privacy notice version.

create trigger audit_school_settings
  after insert or update or delete on school_settings
  for each row execute function audit_row();

create function update_school_settings(
  p_actor uuid,
  p_name text,
  p_timezone text,
  p_consent_notice_version text
) returns void
language plpgsql as $$
begin
  perform require_admin(p_actor);

  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'invalid: school name cannot be blank';
  end if;

  if length(trim(coalesce(p_timezone, ''))) = 0 then
    raise exception 'invalid: timezone cannot be blank';
  end if;

  if length(trim(coalesce(p_consent_notice_version, ''))) = 0 then
    raise exception 'invalid: consent notice version cannot be blank';
  end if;

  update school_settings
  set name = trim(p_name),
      timezone = trim(p_timezone),
      consent_notice_version = trim(p_consent_notice_version)
  where id = true;
end;
$$;

revoke execute on function update_school_settings(uuid, text, text, text) from anon, authenticated;
grant execute on function update_school_settings(uuid, text, text, text) to service_role;
