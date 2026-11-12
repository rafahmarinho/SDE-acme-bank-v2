-- ACME Bank: private storage for generated statements.
--   * Bucket is private: there are no public URLs. Downloads use short-lived signed URLs issued by the API.
--   * Object paths are server-generated: {customer_uuid}/{statement_uuid}.{csv|pdf}
--   * Customers may only read objects under their own folder. Nobody but the service role can write.
--   * Supabase Storage encrypts objects at rest.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statements', 'statements', false, 5242880, array['application/pdf', 'text/csv'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy statements_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid())::text);
