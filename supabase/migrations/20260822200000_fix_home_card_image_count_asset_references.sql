-- Forward migration: expose the unique visible image total without expanding card previews.

-- Forward repair: 20260822150000 may already be recorded before totalFileCount was added.

create or replace function public.get_home_workspace_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'portals', coalesce((select jsonb_agg(portal_row order by (portal_row->>'updatedAt') desc) from (
      select jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'updatedAt', p.updated_at,
        'visibility', p.visibility, 'isPurchased', false,
        'isFavorite', exists(select 1 from portal_favorites f where f.user_id=auth.uid() and f.portal_id=p.id),
        'hasPurchasedPlan', exists(select 1 from portal_entitlements e where e.portal_id=p.id and e.status='active'),
        'purchasedAt', null, 'canDelete', not (p.visibility='paid' and exists(select 1 from paid_portal_purchases pp where pp.portal_id=p.id)),
        'plan', public.portal_plan(p.id),
        'storageUsedBytes', coalesce((select sum(a.size_bytes) from portal_assets a where a.portal_id=p.id and (a.state='ready' or (a.state='reserved' and a.reservation_expires_at > now()))),0),
        'fileTypes', coalesce((select jsonb_agg(extension order by extension) from (
          select distinct lower(regexp_replace(file_item->>'file_name', '^.*\.', '')) extension
          from portal_documents pd
          cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) section(item)
          cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'files','[]'::jsonb)) file(file_item)
          where pd.portal_id=p.id and section.item->>'type'='files'
            and coalesce((section.item->>'visible')::boolean,true)
            and coalesce((file_item->>'visible')::boolean,true)
            and lower(regexp_replace(file_item->>'file_name', '^.*\.', '')) in ('ai','psd','eps','pdf')
        ) file_extensions), '[]'::jsonb),
        'totalFileCount', (select count(*)
          from portal_documents pd
          cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) section(item)
          cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'files','[]'::jsonb)) file(file_item)
          where pd.portal_id=p.id and section.item->>'type'='files'
            and coalesce((section.item->>'visible')::boolean,true)
            and coalesce((file_item->>'visible')::boolean,true)),
        'colors', coalesce((select jsonb_agg(color_code order by section_position, color_position) from (
          select color_code, section_position, color_position from (
            select color_code, section_position, color_position,
              row_number() over (partition by lower(color_code) order by section_position, color_position) duplicate_rank
            from (
              select color_item->>'color_code' color_code, section.ordinality section_position, color.ordinality color_position
              from portal_documents pd
              cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'colors','[]'::jsonb)) with ordinality color(color_item, ordinality)
              where pd.portal_id=p.id and section.item->>'type'='colors'
                and coalesce((section.item->>'visible')::boolean,true)
                and coalesce((color_item->>'visible')::boolean,true)
                and color_item->>'color_code' is not null
            ) raw_colors
          ) unique_colors where duplicate_rank=1
          order by section_position, color_position limit 5
        ) palette), '[]'::jsonb),
        'totalImageCount', (select count(distinct image_url) from (
          select coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') image_url, image_item
          from portal_documents pd
          cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) section(item)
          cross join lateral (select section.item->'content'->'image' image_item where section.item->>'type'='image'
            union all select image_item from jsonb_array_elements(coalesce(section.item->'content'->'images','[]'::jsonb)) image(image_item)
            where section.item->>'type' in ('gallery','image_comparison')) images
          where pd.portal_id=p.id and coalesce((section.item->>'visible')::boolean,true)
        ) visible_images where image_url is not null and image_url <> ''
          and coalesce((image_item->>'visible')::boolean,true)),
        'images', coalesce((select jsonb_agg(jsonb_build_object(
          'url', image_item->>'image_url', 'alt', coalesce(image_item->>'alt_text',''),
          'assetId', image_item->>'asset_id', 'storagePath', image_item->>'storage_path',
          'backgroundColor', image_item->>'background_color', 'containerPadding', image_item->'container_padding',
          'width', image_item->'width', 'height', image_item->'height'
        ) order by section_position, image_position) from (
          select image_item, section_position, image_position from (
            select image_item, section_position, image_position,
              row_number() over (partition by coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') order by section_position, image_position) duplicate_rank
            from (
              select section.item->'content'->'image' image_item, section.ordinality section_position, 0::bigint image_position
              from portal_documents pd
              cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              where pd.portal_id=p.id and section.item->>'type'='image'
                and coalesce((section.item->>'visible')::boolean,true)
              union all
              select image_item, section.ordinality, image.ordinality
              from portal_documents pd
              cross join lateral jsonb_array_elements(coalesce(pd.document->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'images','[]'::jsonb)) with ordinality image(image_item, ordinality)
              where pd.portal_id=p.id and section.item->>'type' in ('gallery','image_comparison')
                and coalesce((section.item->>'visible')::boolean,true)
            ) raw_images where coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') is not null
              and coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') <> '' and coalesce((image_item->>'visible')::boolean,true)
          ) unique_images where duplicate_rank=1 order by section_position, image_position limit 1
        ) preview_images), '[]'::jsonb)
      ) portal_row from portals p where p.owner_id=auth.uid()
      union all
      select jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'updatedAt', p.updated_at,
        'visibility', p.visibility, 'isPurchased', true,
        'isFavorite', exists(select 1 from portal_favorites f where f.user_id=auth.uid() and f.portal_id=p.id),
        'hasPurchasedPlan', false, 'purchasedAt', g.granted_at, 'canDelete', false,
        'plan', 'free', 'storageUsedBytes', 0,
        'fileTypes', coalesce((select jsonb_agg(extension order by extension) from (
          select distinct lower(regexp_replace(file_item->>'file_name', '^.*\.', '')) extension
          from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) section(item)
          cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'files','[]'::jsonb)) file(file_item)
          where section.item->>'type'='files'
            and coalesce((section.item->>'visible')::boolean,true)
            and coalesce((file_item->>'visible')::boolean,true)
            and lower(regexp_replace(file_item->>'file_name', '^.*\.', '')) in ('ai','psd','eps','pdf')
        ) file_extensions), '[]'::jsonb),
        'totalFileCount', (select count(*)
          from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) section(item)
          cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'files','[]'::jsonb)) file(file_item)
          where section.item->>'type'='files'
            and coalesce((section.item->>'visible')::boolean,true)
            and coalesce((file_item->>'visible')::boolean,true)),
        'colors', coalesce((select jsonb_agg(color_code order by section_position, color_position) from (
          select color_code, section_position, color_position from (
            select color_code, section_position, color_position,
              row_number() over (partition by lower(color_code) order by section_position, color_position) duplicate_rank
            from (
              select color_item->>'color_code' color_code, section.ordinality section_position, color.ordinality color_position
              from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'colors','[]'::jsonb)) with ordinality color(color_item, ordinality)
              where section.item->>'type'='colors'
                and coalesce((section.item->>'visible')::boolean,true)
                and coalesce((color_item->>'visible')::boolean,true)
                and color_item->>'color_code' is not null
            ) raw_colors
          ) unique_colors where duplicate_rank=1
          order by section_position, color_position limit 5
        ) palette), '[]'::jsonb),
        'totalImageCount', (select count(distinct image_url) from (
          select coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') image_url, image_item
          from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) section(item)
          cross join lateral (select section.item->'content'->'image' image_item where section.item->>'type'='image'
            union all select image_item from jsonb_array_elements(coalesce(section.item->'content'->'images','[]'::jsonb)) image(image_item)
            where section.item->>'type' in ('gallery','image_comparison')) images
          where coalesce((section.item->>'visible')::boolean,true)
        ) visible_images where image_url is not null and image_url <> ''
          and coalesce((image_item->>'visible')::boolean,true)),
        'images', coalesce((select jsonb_agg(jsonb_build_object(
          'url', image_item->>'image_url', 'alt', coalesce(image_item->>'alt_text',''),
          'assetId', image_item->>'asset_id', 'storagePath', image_item->>'storage_path',
          'backgroundColor', image_item->>'background_color', 'containerPadding', image_item->'container_padding',
          'width', image_item->'width', 'height', image_item->'height'
        ) order by section_position, image_position) from (
          select image_item, section_position, image_position from (
            select image_item, section_position, image_position,
              row_number() over (partition by coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') order by section_position, image_position) duplicate_rank
            from (
              select section.item->'content'->'image' image_item, section.ordinality section_position, 0::bigint image_position
              from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              where section.item->>'type'='image' and coalesce((section.item->>'visible')::boolean,true)
              union all
              select image_item, section.ordinality, image.ordinality
              from jsonb_array_elements(coalesce(publication.snapshot->'document'->'sections','[]'::jsonb)) with ordinality section(item, ordinality)
              cross join lateral jsonb_array_elements(coalesce(section.item->'content'->'images','[]'::jsonb)) with ordinality image(image_item, ordinality)
              where section.item->>'type' in ('gallery','image_comparison')
                and coalesce((section.item->>'visible')::boolean,true)
            ) raw_images where coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') is not null
              and coalesce(image_item->>'image_url', image_item->>'asset_id', image_item->>'storage_path') <> '' and coalesce((image_item->>'visible')::boolean,true)
          ) unique_images where duplicate_rank=1 order by section_position, image_position limit 1
        ) preview_images), '[]'::jsonb)
      ) portal_row from paid_portal_access_grants g join portals p on p.id=g.portal_id
      join portal_publications publication on publication.id=p.published_publication_id
      where g.buyer_id=auth.uid() and g.status='paid' and p.visibility='paid' and p.status='published'
        and p.owner_id <> auth.uid()
    ) rows), '[]'::jsonb),
    'connect', coalesce((select jsonb_build_object(
      'accountExists', true, 'accountId', a.stripe_account_id, 'chargesEnabled', a.charges_enabled,
      'detailsSubmitted', a.details_submitted, 'payoutsEnabled', a.payouts_enabled,
      'connected', a.onboarding_status='complete' and a.details_submitted and a.charges_enabled and a.payouts_enabled,
      'accountEmail', a.account_email, 'country', a.country, 'displayName', a.display_name,
      'requirementsPending', a.requirements_pending, 'verificationState', a.verification_state,
      'lastSyncedAt', a.last_synced_at, 'needsSync', a.last_synced_at is null or a.last_synced_at < now() - interval '1 day'
        or a.account_email is null or a.country is null or a.display_name is null
    ) from creator_stripe_accounts a where a.owner_id=auth.uid()),
      jsonb_build_object('accountExists',false,'connected',false,'accountEmail',null,'country',null,'displayName',null,
        'requirementsPending',0,'verificationState','not_started','lastSyncedAt',null,'needsSync',false))
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_home_workspace_summary() from public, anon;
grant execute on function public.get_home_workspace_summary() to authenticated;
