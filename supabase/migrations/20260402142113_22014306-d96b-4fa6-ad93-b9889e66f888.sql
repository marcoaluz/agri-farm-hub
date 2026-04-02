
-- Tabela de rebanhos/lotes
CREATE TABLE public.rebanhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL,
  nome TEXT NOT NULL,
  especie TEXT NOT NULL DEFAULT 'bovino_corte',
  raca TEXT,
  finalidade TEXT,
  localizacao TEXT,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  data_formacao DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de movimentações do rebanho
CREATE TABLE public.rebanho_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebanho_id UUID NOT NULL REFERENCES public.rebanhos(id) ON DELETE CASCADE,
  propriedade_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  data_evento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_unitario NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  peso_medio_kg NUMERIC(10,2),
  fornecedor_comprador TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de eventos sanitários
CREATE TABLE public.sanitario_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebanho_id UUID REFERENCES public.rebanhos(id) ON DELETE SET NULL,
  propriedade_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_aplicacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_proxima DATE,
  quantidade_dose NUMERIC(10,2),
  custo NUMERIC(12,2),
  lote_produto TEXT,
  responsavel TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de ordenhas
CREATE TABLE public.ordenhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebanho_id UUID NOT NULL REFERENCES public.rebanhos(id) ON DELETE CASCADE,
  propriedade_id UUID NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  turno TEXT NOT NULL DEFAULT 'unico',
  litros NUMERIC(10,2) NOT NULL,
  vacas_ordenhadas INTEGER,
  qualidade TEXT,
  destino TEXT DEFAULT 'venda',
  preco_litro NUMERIC(10,4),
  valor_total NUMERIC(12,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar quantidade_atual do rebanho
CREATE OR REPLACE FUNCTION public.atualizar_quantidade_rebanho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  delta INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Reverter a movimentação deletada
    IF OLD.tipo IN ('nascimento', 'compra', 'transferencia_entrada', 'ajuste_entrada') THEN
      delta := -OLD.quantidade;
    ELSE
      delta := OLD.quantidade;
    END IF;
    UPDATE rebanhos SET quantidade_atual = quantidade_atual + delta, updated_at = now() WHERE id = OLD.rebanho_id;
    RETURN OLD;
  END IF;

  IF NEW.tipo IN ('nascimento', 'compra', 'transferencia_entrada', 'ajuste_entrada') THEN
    delta := NEW.quantidade;
  ELSIF NEW.tipo IN ('venda', 'morte', 'transferencia_saida', 'ajuste_saida') THEN
    delta := -NEW.quantidade;
  ELSE
    delta := 0;
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE rebanhos SET quantidade_atual = quantidade_atual + delta, updated_at = now() WHERE id = NEW.rebanho_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter antigo
    DECLARE old_delta INTEGER;
    BEGIN
      IF OLD.tipo IN ('nascimento', 'compra', 'transferencia_entrada', 'ajuste_entrada') THEN
        old_delta := -OLD.quantidade;
      ELSIF OLD.tipo IN ('venda', 'morte', 'transferencia_saida', 'ajuste_saida') THEN
        old_delta := OLD.quantidade;
      ELSE
        old_delta := 0;
      END IF;
      UPDATE rebanhos SET quantidade_atual = quantidade_atual + old_delta + delta, updated_at = now() WHERE id = NEW.rebanho_id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_quantidade_rebanho
AFTER INSERT OR UPDATE OR DELETE ON public.rebanho_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.atualizar_quantidade_rebanho();

-- Trigger para calcular valor_total na ordenha
CREATE OR REPLACE FUNCTION public.calcular_valor_ordenha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.preco_litro IS NOT NULL AND NEW.litros IS NOT NULL THEN
    NEW.valor_total := NEW.litros * NEW.preco_litro;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_valor_ordenha
BEFORE INSERT OR UPDATE ON public.ordenhas
FOR EACH ROW EXECUTE FUNCTION public.calcular_valor_ordenha();

-- Trigger para calcular valor_total na movimentação
CREATE OR REPLACE FUNCTION public.calcular_valor_movimentacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.valor_unitario IS NOT NULL AND NEW.quantidade IS NOT NULL THEN
    NEW.valor_total := NEW.valor_unitario * NEW.quantidade;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_valor_movimentacao
BEFORE INSERT OR UPDATE ON public.rebanho_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.calcular_valor_movimentacao();

-- RLS
ALTER TABLE public.rebanhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebanho_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanitario_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage rebanhos" ON public.rebanhos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage movimentacoes" ON public.rebanho_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sanitario" ON public.sanitario_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage ordenhas" ON public.ordenhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
