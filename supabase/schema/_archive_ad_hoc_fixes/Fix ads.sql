REVOKE ALL ON TABLE public.ads
FROM anon, authenticated;

GRANT SELECT ON TABLE public.ads
TO anon, authenticated;

GRANT INSERT ON TABLE public.ads
TO authenticated;

GRANT UPDATE, DELETE ON TABLE public.ads
TO authenticated;