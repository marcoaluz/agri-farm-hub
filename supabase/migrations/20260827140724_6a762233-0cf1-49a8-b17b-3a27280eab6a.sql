-- Políticas RLS para o bucket 'avatars' (bucket já criado via Storage API)
-- Permite ao usuário ler/escrever apenas seus próprios avatares (pasta = user_id)
create policy "Avatar read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Avatar upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Avatar update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Leitura pública anônima (para exibir a foto em qualquer contexto sem login)
create policy "Avatar public read"
  on storage.objects for select
  to anon
  using (bucket_id = 'avatars');