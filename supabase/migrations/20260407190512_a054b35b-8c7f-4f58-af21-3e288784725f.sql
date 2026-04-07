
CREATE TABLE public.pesagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL,
  rebanho_id uuid NOT NULL REFERENCES public.rebanhos(id) ON DELETE CASCADE,
  data_pesagem date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg numeric NOT NULL,
  peso_anterior_kg numeric,
  gmd_kg numeric,
  responsavel text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pesagens"
  ON public.pesagens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
