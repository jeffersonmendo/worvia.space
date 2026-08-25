-- Raise the paid portal operating floor to $4.35 while preserving the $500 cap; commission is calculated by the checkout runtime.
alter table public.paid_portal_offers
  drop constraint if exists paid_portal_offers_price_cents_check,
  add constraint paid_portal_offers_price_cents_check
    check (price_cents between 435 and 50000) not valid;

alter table public.paid_portal_checkout_attempts
  drop constraint if exists paid_portal_checkout_attempts_amount_total_check,
  add constraint paid_portal_checkout_attempts_amount_total_check
    check (amount_total between 435 and 50000) not valid;

create or replace function public.upsert_paid_portal_offer(
  target_portal_id uuid,
  offer_price_cents integer,
  offer_currency text default 'usd',
  offer_preview_asset_ids uuid[] default '{}',
  offer_preview_metadata jsonb default '{}'::jsonb,
  offer_is_active boolean default true
) returns public.paid_portal_offers
language plpgsql security definer set search_path = public as $$
declare saved public.paid_portal_offers; invalid_asset boolean;
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if lower(coalesce(offer_currency, '')) <> 'usd' then raise exception 'Paid portal offers must use USD'; end if;
  if offer_price_cents < 435 or offer_price_cents > 50000 then
    raise exception 'Paid portal price must be between 435 and 50000 cents';
  end if;
  if jsonb_typeof(coalesce(offer_preview_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Preview metadata must be an object';
  end if;
  select exists (
    select 1 from unnest(coalesce(offer_preview_asset_ids, '{}'::uuid[])) asset_id
    where not exists (
      select 1 from public.portal_assets a
      where a.id = asset_id and a.portal_id = target_portal_id and a.state = 'ready'
    )
  ) into invalid_asset;
  if invalid_asset then raise exception 'Preview assets must belong to the portal and be ready'; end if;
  insert into public.paid_portal_offers(
    portal_id, price_cents, currency, selected_preview_asset_ids, preview_metadata, is_active
  ) values (
    target_portal_id, offer_price_cents, 'usd',
    coalesce(offer_preview_asset_ids, '{}'::uuid[]), coalesce(offer_preview_metadata, '{}'::jsonb), offer_is_active
  ) on conflict (portal_id) do update set
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    selected_preview_asset_ids = excluded.selected_preview_asset_ids,
    preview_metadata = excluded.preview_metadata,
    is_active = excluded.is_active,
    updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

-- Existing offers below the new floor remain unchanged, but cannot be purchased.
create or replace function public.begin_paid_portal_checkout(target_portal_id uuid)
returns public.paid_portal_checkout_attempts
language plpgsql security definer set search_path = public as $$
declare saved public.paid_portal_checkout_attempts;
declare target_owner uuid;
declare offer public.paid_portal_offers;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.owner_id into target_owner from public.portals p
    where p.id = target_portal_id and p.visibility = 'paid'
      and p.status = 'published' and p.published_publication_id is not null;
  if target_owner is null then raise exception 'Paid portal is not available'; end if;
  if not public.creator_has_active_connect_onboarding(target_owner) then
    raise exception 'Paid portal requires active Connect onboarding';
  end if;
  select * into offer from public.paid_portal_offers
    where portal_id = target_portal_id and is_active;
  if offer.portal_id is null then raise exception 'Paid portal requires an active offer'; end if;
  if offer.price_cents < 435 then
    raise exception 'Paid portal offer must be updated to at least 435 cents before checkout';
  end if;
  select * into saved from public.paid_portal_checkout_attempts
    where portal_id = target_portal_id and buyer_id = auth.uid() and status = 'pending'
      and updated_at > now() - interval '24 hours'
    order by created_at desc limit 1;
  if saved.id is null or saved.amount_total <> offer.price_cents or saved.currency <> offer.currency then
    insert into public.paid_portal_checkout_attempts(portal_id,buyer_id,amount_total,currency,idempotency_key)
      values(target_portal_id,auth.uid(),offer.price_cents,offer.currency,gen_random_uuid()::text)
      returning * into saved;
  end if;
  return saved;
end;
$$;
