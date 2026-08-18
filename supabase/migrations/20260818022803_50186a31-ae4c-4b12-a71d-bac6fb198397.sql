CREATE TABLE public.categorias_manutencao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_manutencao TO authenticated;
GRANT ALL ON public.categorias_manutencao TO service_role;

ALTER TABLE public.categorias_manutencao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage categorias_manutencao"
ON public.categorias_manutencao
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE UNIQUE INDEX categorias_manutencao_nome_ativo_uniq
ON public.categorias_manutencao (LOWER(nome))
WHERE ativo = true;

INSERT INTO public.categorias_manutencao (nome) VALUES
  ('Preventiva'), ('Corretiva'), ('Revisão'), ('Troca de Óleo'),
  ('Troca de Filtro'), ('Pneu'), ('Elétrica'), ('Outro');

CREATE OR REPLACE FUNCTION public.listar_categorias_manutencao()
RETURNS TABLE(id UUID, nome TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT id, nome
  FROM public.categorias_manutencao
  WHERE ativo = true
  ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.listar_categorias_manutencao() TO authenticated;