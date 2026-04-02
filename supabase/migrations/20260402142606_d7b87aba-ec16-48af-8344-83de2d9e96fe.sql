
CREATE TABLE public.propriedade_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL UNIQUE,
  lavoura BOOLEAN NOT NULL DEFAULT true,
  pecuaria BOOLEAN NOT NULL DEFAULT true,
  financeiro BOOLEAN NOT NULL DEFAULT true,
  relatorios BOOLEAN NOT NULL DEFAULT true,
  auditoria BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.propriedade_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage modulos" ON public.propriedade_modulos FOR ALL TO authenticated USING (true) WITH CHECK (true);
