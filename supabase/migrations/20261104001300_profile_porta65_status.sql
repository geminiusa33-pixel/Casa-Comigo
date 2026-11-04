-- Store an optional user-reported Porta 65 status, separate from discovery data.
alter table public.profiles
  add column porta65_status text not null default 'unknown'
  check (porta65_status in ('unknown', 'interested', 'possibly_eligible', 'not_applicable', 'receiving'));
