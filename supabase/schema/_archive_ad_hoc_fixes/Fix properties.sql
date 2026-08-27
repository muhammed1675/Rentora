REVOKE ALL ON TABLE public.properties
FROM anon, authenticated;

GRANT SELECT ON TABLE public.properties
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE public.properties
TO authenticated;