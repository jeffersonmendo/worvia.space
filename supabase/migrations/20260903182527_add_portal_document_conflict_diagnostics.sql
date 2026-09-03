create or replace function public.upsert_portal_document_if_revision(
  target_portal_id uuid,
  portal_document jsonb,
  expected_revision bigint default null
)
returns public.portal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_document public.portal_documents;
  document_portal jsonb;
  current_revision bigint;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_portal_id::text, 0)
  );

  select revision
  into current_revision
  from public.portal_documents
  where portal_id = target_portal_id;

  if current_revision is distinct from expected_revision then
    raise exception using
      errcode = '40001',
      message = format(
        'portal_document_conflict portal=%s current=%s expected=%s uid=%s session=%s',
        target_portal_id,
        current_revision,
        expected_revision,
        auth.uid(),
        auth.jwt() ->> 'session_id'
      );
  end if;

  if coalesce((portal_document ->> 'version')::integer, 0) <> 1 then
    raise exception 'Unsupported portal document version';
  end if;

  if jsonb_typeof(portal_document -> 'sections') <> 'array' then
    raise exception 'Portal document sections must be an array';
  end if;

  perform public.validate_portal_document_policy(
    target_portal_id,
    portal_document,
    false
  );

  if exists (
    select 1
    from public.portal_document_asset_ids(portal_document) reference
    where not exists (
      select 1
      from public.portal_assets asset
      where asset.id = reference.asset_id
        and asset.portal_id = target_portal_id
        and asset.state = 'ready'
        and asset.deletion_requested_at is null
    )
  ) then
    raise exception 'Portal document references an unavailable asset'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.portal_documents(
    portal_id,
    document
  )
  values (
    target_portal_id,
    portal_document
  )
  on conflict(portal_id) do update
  set
    document = excluded.document,
    updated_at = now()
  returning * into saved_document;

  document_portal := portal_document -> 'portal';

  update public.portals
  set
    name = coalesce(
      nullif(document_portal ->> 'name', ''),
      name
    ),
    short_description = nullif(
      document_portal ->> 'description',
      ''
    ),
    cover_url = coalesce(
      document_portal ->> 'cover_url',
      cover_url
    ),
    icon_url = coalesce(
      document_portal ->> 'icon_url',
      icon_url
    ),
    theme = coalesce(
      (document_portal ->> 'theme')::public.portal_theme,
      theme
    )
  where id = target_portal_id;

  return saved_document;
end;
$$;

revoke all on function public.upsert_portal_document_if_revision(
  uuid,
  jsonb,
  bigint
) from public, anon;

grant execute on function public.upsert_portal_document_if_revision(
  uuid,
  jsonb,
  bigint
) to authenticated;