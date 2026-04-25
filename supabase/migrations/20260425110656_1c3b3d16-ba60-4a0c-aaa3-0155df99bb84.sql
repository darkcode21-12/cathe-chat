-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Profiles (anonymous handle)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  file_url text,
  file_type text,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Random handle generator
create or replace function public.generate_random_handle()
returns text language plpgsql as $$
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

-- Trigger: create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle) values (new.id, public.generate_random_handle());
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: profiles
create policy "Authenticated can view profile handles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- RLS: user_roles
create policy "Users can view own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert roles"
  on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete roles"
  on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- RLS: messages
create policy "Authenticated can view messages"
  on public.messages for select to authenticated using (true);

create policy "Authenticated can insert own messages"
  on public.messages for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can delete own messages"
  on public.messages for delete to authenticated using (auth.uid() = user_id);

create policy "Admins can delete any message"
  on public.messages for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Realtime
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;

-- Storage bucket for chat files
insert into storage.buckets (id, name, public) values ('chat-files', 'chat-files', true);

create policy "Public can view chat files"
  on storage.objects for select using (bucket_id = 'chat-files');

create policy "Authenticated can upload chat files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own chat files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- Admin user list view
create or replace function public.admin_list_users()
returns table (user_id uuid, handle text, email text, created_at timestamptz, is_admin boolean)
language sql stable security definer set search_path = public
as $$
  select p.id, p.handle, u.email, p.created_at,
    exists(select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') as is_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.has_role(auth.uid(), 'admin')
  order by p.created_at desc
$$;

-- Admin: see real identity for a message
create or replace function public.admin_message_identity(_message_id uuid)
returns table (email text, handle text)
language sql stable security definer set search_path = public
as $$
  select u.email, p.handle
  from public.messages m
  join auth.users u on u.id = m.user_id
  join public.profiles p on p.id = m.user_id
  where m.id = _message_id and public.has_role(auth.uid(), 'admin')
$$;