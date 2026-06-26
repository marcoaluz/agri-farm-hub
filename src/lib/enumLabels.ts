// Mapeamento value (enum no Postgres) -> label amigável para exibição.
// IMPORTANTE: nunca usar estes labels como valor gravado no banco.

export const UNIDADE_LABELS: Record<string, string> = {
  kg: 'Quilograma (kg)',
  ton: 'Tonelada (ton)',
  litro: 'Litro (L)',
  ml: 'Mililitro (ml)',
  saca: 'Saca (60kg)',
  hora: 'Hora (h)',
  dia: 'Dia',
  diaria: 'Diária',
  ha: 'Hectare (ha)',
  unidade: 'Unidade (un)',
  servico: 'Serviço',
};

export const ESPECIE_LABELS: Record<string, string> = {
  bovino_corte: 'Bovino de Corte',
  bovino_leite: 'Bovino de Leite',
  ave_postura: 'Ave de Postura',
  ave_corte: 'Ave de Corte',
  suino: 'Suíno',
  ovino: 'Ovino',
  equino: 'Equino',
  outro: 'Outro',
};

export const SEXO_ANIMAL_LABELS: Record<string, string> = {
  macho: 'Macho',
  femea: 'Fêmea',
  nao_definido: 'Não definido',
};

export const TRANSACAO_TIPO_LABELS: Record<string, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

export const TRANSACAO_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
};

export const TRANSACAO_CATEGORIA_LABELS: Record<string, string> = {
  insumos: 'Insumos',
  combustivel: 'Combustível',
  manutencao: 'Manutenção',
  mao_de_obra: 'Mão de Obra',
  arrendamento: 'Arrendamento',
  maquinario: 'Maquinário',
  venda_producao: 'Venda de Produção',
  servicos_terceiros: 'Serviços de Terceiros',
  impostos: 'Impostos',
  outros: 'Outros',
  sanidade_animal: 'Sanidade Animal',
  alimentacao_animal: 'Alimentação Animal',
  compra_animais: 'Compra de Animais',
  venda_animais: 'Venda de Animais',
};

export const PAPEL_USUARIO_LABELS: Record<string, string> = {
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  operador: 'Operador',
  visualizador: 'Visualizador',
};

export const SERVICO_TIPO_LABELS: Record<string, string> = {
  simples: 'Simples',
  composto: 'Composto',
};

export function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '';
  return map[value] ?? value;
}
