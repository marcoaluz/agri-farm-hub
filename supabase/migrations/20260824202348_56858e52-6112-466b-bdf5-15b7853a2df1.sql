CREATE TABLE public.tipos_combustivel (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_combustivel TO authenticated;
GRANT ALL ON public.tipos_combustivel TO service_role;

ALTER TABLE public.tipos_combustivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fuel types"
  ON public.tipos_combustivel
  FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE OR REPLACE FUNCTION public.listar_tipos_combustivel()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT id, nome
  FROM public.tipos_combustivel
  WHERE ativo = true
    AND (usuario_id = auth.uid() OR usuario_id IS NULL)
  ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.listar_tipos_combustivel() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_tipos_combustivel_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tipos_combustivel_updated_at
  BEFORE UPDATE ON public.tipos_combustivel
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tipos_combustivel_updated_at();