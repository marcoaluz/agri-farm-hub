/**
 * Vocabulário de unidades de produção e formas de armazenamento.
 * NÃO contém regra por cultura — cada cultura escolhe sua unidade no cadastro
 * (tabela culturas_config), portanto novas culturas não exigem alteração de código.
 */

export interface UnidadeProducao {
  codigo: string;
  label: string;
  /** Peso em kg de 1 unidade (null quando não há conversão direta) */
  pesoPorUnidade: number | null;
}

export const UNIDADES_PRODUCAO: UnidadeProducao[] = [
  { codigo: "kg", label: "Kg", pesoPorUnidade: 1 },
  { codigo: "tonelada", label: "Toneladas", pesoPorUnidade: 1000 },
  { codigo: "saca_60kg", label: "Sacas (60kg)", pesoPorUnidade: 60 },
  { codigo: "saca_50kg", label: "Sacas (50kg)", pesoPorUnidade: 50 },
  { codigo: "arroba", label: "Arrobas", pesoPorUnidade: 15 },
  { codigo: "caixa_22kg", label: "Caixas (22kg)", pesoPorUnidade: 22 },
  { codigo: "caixa", label: "Caixas", pesoPorUnidade: null },
  { codigo: "cacho", label: "Cachos", pesoPorUnidade: null },
  { codigo: "m3", label: "m³", pesoPorUnidade: null },
  { codigo: "unidade", label: "Unidades", pesoPorUnidade: null },
  { codigo: "litro", label: "Litros", pesoPorUnidade: null },
];

export const FORMAS_ARMAZENAMENTO = [
  "Silo",
  "Armazém",
  "Galpão",
  "Câmara fria",
  "Pátio",
  "Campo",
  "Beneficiamento",
  "Comercialização direta",
];

export function unidadePorCodigo(codigo?: string | null) {
  return UNIDADES_PRODUCAO.find((u) => u.codigo === codigo);
}
