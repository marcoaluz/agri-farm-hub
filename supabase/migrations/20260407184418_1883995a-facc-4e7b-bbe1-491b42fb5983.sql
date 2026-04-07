
CREATE TABLE public.maquina_manutencoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  propriedade_id UUID NOT NULL,
  maquina_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendada',
  data_prevista DATE,
  data_realizada DATE,
  horimetro_manutencao NUMERIC,
  proximo_horimetro NUMERIC,
  custo NUMERIC,
  oficina TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.maquina_manutencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage manutencoes"
  ON public.maquina_manutencoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
