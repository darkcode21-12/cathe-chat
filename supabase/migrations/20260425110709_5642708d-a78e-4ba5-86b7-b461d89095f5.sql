create or replace function public.generate_random_handle()
returns text language plpgsql security definer set search_path = public as $$
declare
  adjectives text[] := array['Blue','Red','Green','Silver','Golden','Swift','Brave','Quiet','Cosmic','Wild','Mystic','Lucky','Happy','Clever','Sneaky','Royal','Fuzzy','Sunny','Stormy','Hidden'];
  animals text[] := array['Fox','Wolf','Tiger','Eagle','Otter','Falcon','Panda','Lynx','Hawk','Bear','Shark','Owl','Cobra','Raven','Whale','Dragon','Lion','Cat','Moose','Koala'];
  candidate text;
  i int := 0;
begin
  loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives,1))::int]
              || animals[1 + floor(random() * array_length(animals,1))::int]
              || floor(random() * 1000)::int::text;
    exit when not exists (select 1 from public.profiles where handle = candidate);
    i := i + 1;
    if i > 20 then candidate := candidate || floor(random() * 100000)::int::text; exit; end if;
  end loop;
  return candidate;
end;
$$;

drop policy if exists "Public can view chat files" on storage.objects;
create policy "Authenticated can view chat files"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-files');