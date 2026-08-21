-- ============================================================================
-- Agro GFI — Cultura define a unidade de produção
-- Script seguro: não apaga dados, não recria tabelas, não altera talhões.
-- Rodar uma única vez no SQL Editor do banco do projeto.
-- ============================================================================

-- 1) Colunas novas em culturas_config (todas opcionais / com default)
ALTER TABLE public.culturas_config
  ADD COLUMN IF NOT EXISTS tipo_produto text,
  ADD COLUMN IF NOT EXISTS peso_por_unidade numeric,
  ADD COLUMN IF NOT EXISTS permite_quantidade_plantas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forma_armazenamento text;

-- 2) Correção das unidades das culturas existentes (não apaga nada)
UPDATE public.culturas_config SET unidade_padrao = 'saca_60kg', unidade_label = 'Sacas (60kg)',
       tipo_produto = COALESCE(tipo_produto,'Café beneficiado'), peso_por_unidade = COALESCE(peso_por_unidade,60),
       permite_quantidade_plantas = true, forma_armazenamento = COALESCE(forma_armazenamento,'Armazém / Silo')
 WHERE nome = 'cafe';

UPDATE public.culturas_config SET unidade_padrao = 'tonelada', unidade_label = 'Toneladas',
       tipo_produto = COALESCE(tipo_produto,'Milho em grão'), peso_por_unidade = COALESCE(peso_por_unidade,1000),
       permite_quantidade_plantas = false, forma_armazenamento = COALESCE(forma_armazenamento,'Silo / Armazém')
 WHERE nome = 'milho';

UPDATE public.culturas_config SET unidade_padrao = 'tonelada', unidade_label = 'Toneladas',
       tipo_produto = COALESCE(tipo_produto,'Soja em grão'), peso_por_unidade = COALESCE(peso_por_unidade,1000),
       permite_quantidade_plantas = false, forma_armazenamento = COALESCE(forma_armazenamento,'Silo / Armazém')
 WHERE nome = 'soja';

UPDATE public.culturas_config SET tipo_produto = COALESCE(tipo_produto,'Fruta'),
       peso_por_unidade = COALESCE(peso_por_unidade,22), forma_armazenamento = COALESCE(forma_armazenamento,'Galpão')
 WHERE nome = 'abacate';

UPDATE public.culturas_config SET tipo_produto = COALESCE(tipo_produto,'Silagem'),
       peso_por_unidade = COALESCE(peso_por_unidade,1000), permite_quantidade_plantas = false,
       forma_armazenamento = COALESCE(forma_armazenamento,'Silo')
 WHERE nome = 'silagem';

-- 3) Culturas novas (não sobrescreve as existentes)
INSERT INTO public.culturas_config
  (nome, nome_exibicao, unidade_padrao, unidade_label, icone, tipo_produto, peso_por_unidade, permite_quantidade_plantas, forma_armazenamento, ativo)
VALUES
  -- Grãos e cereais
  ('trigo','Trigo','tonelada','Toneladas','🌾','Trigo em grão',1000,false,'Silo / Armazém',true),
  ('arroz','Arroz','tonelada','Toneladas','🌾','Arroz em casca',1000,false,'Silo / Armazém',true),
  ('feijao','Feijão','saca_60kg','Sacas (60kg)','🫘','Feijão',60,false,'Armazém',true),
  ('girassol','Girassol','tonelada','Toneladas','🌻','Grãos',1000,false,'Silo / Armazém',true),
  ('sorgo','Sorgo','tonelada','Toneladas','🌱','Grãos',1000,false,'Silo / Armazém',true),
  ('amendoim','Amendoim','saca_60kg','Sacas (60kg)','🥜','Grãos',60,false,'Armazém',true),
  -- Frutas
  ('laranja','Laranja','kg','Kg','🍊','Fruta',1,true,'Galpão / Comercialização',true),
  ('limao','Limão','kg','Kg','🍋','Fruta',1,true,'Galpão',true),
  ('banana','Banana','kg','Kg','🍌','Fruta',1,true,'Galpão',true),
  ('manga','Manga','kg','Kg','🥭','Fruta',1,true,'Galpão',true),
  ('uva','Uva','kg','Kg','🍇','Fruta',1,true,'Câmara fria / Galpão',true),
  ('coco','Coco','unidade','Unidades','🥥','Fruto',NULL,true,'Galpão',true),
  ('acai','Açaí','kg','Kg','🌴','Fruto',1,true,'Beneficiamento',true),
  -- Hortaliças e raízes
  ('tomate','Tomate','kg','Kg','🍅','Fruto',1,true,'Galpão / Câmara fria',true),
  ('batata','Batata','kg','Kg','🥔','Tubérculo',1,false,'Galpão',true),
  ('cebola','Cebola','kg','Kg','🧅','Bulbo',1,false,'Galpão',true),
  ('cenoura','Cenoura','kg','Kg','🥕','Raiz',1,false,'Galpão / Câmara fria',true),
  ('hortalicas','Hortaliças','kg','Kg','🥬','Hortaliças',1,false,'Câmara fria',true),
  ('mandioca','Mandioca','tonelada','Toneladas','🌿','Raiz',1000,false,'Campo / Beneficiamento',true),
  -- Culturas industriais
  ('cana','Cana-de-açúcar','tonelada','Toneladas','🎋','Cana',1000,false,'Campo / Usina',true),
  ('erva_mate','Erva-mate','tonelada','Toneladas','🌿','Folhas',1000,true,'Beneficiamento',true),
  -- Silvicultura
  ('eucalipto','Eucalipto','m3','m³','🌲','Madeira',NULL,true,'Campo / Pátio',true),
  ('pinus','Pinus','m3','m³','🌲','Madeira',NULL,true,'Pátio',true)
ON CONFLICT (nome) DO NOTHING;

-- 4) Função de criação de cultura com os campos novos (compatível com a chamada antiga)
CREATE OR REPLACE FUNCTION public.criar_cultura_config(
  p_nome_exibicao text,
  p_unidade_padrao text DEFAULT 'unidade',
  p_unidade_label text DEFAULT 'Unidades',
  p_icone text DEFAULT NULL,
  p_tipo_produto text DEFAULT NULL,
  p_peso_por_unidade numeric DEFAULT NULL,
  p_permite_quantidade_plantas boolean DEFAULT true,
  p_forma_armazenamento text DEFAULT NULL
)
RETURNS public.culturas_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_row public.culturas_config;
BEGIN
  v_slug := regexp_replace(lower(trim(p_nome_exibicao)), '[^a-z0-9]+', '_', 'g');

  SELECT * INTO v_row FROM public.culturas_config WHERE nome = v_slug;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.culturas_config
    (nome, nome_exibicao, unidade_padrao, unidade_label, icone, tipo_produto,
     peso_por_unidade, permite_quantidade_plantas, forma_armazenamento, ativo, usuario_id)
  VALUES
    (v_slug, trim(p_nome_exibicao), COALESCE(p_unidade_padrao,'unidade'),
     COALESCE(p_unidade_label,'Unidades'), p_icone, p_tipo_produto,
     p_peso_por_unidade, COALESCE(p_permite_quantidade_plantas, true),
     p_forma_armazenamento, true, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_cultura_config(text,text,text,text,text,numeric,boolean,text) TO authenticated;
