# Cultura define a unidade de produção do talhão

## Situação atual

A tabela de configuração de culturas do banco já existe e já tem unidade:

```text
culturas_config: id, nome, nome_exibicao, unidade_padrao, unidade_label, icone, ativo, usuario_id
```

Hoje só existem 6 culturas cadastradas (Café, Abacate, Soja, Milho, Silagem, Outras) e **os dados estão errados**: Soja e Milho estão como "Sacas (60kg)". O formulário do talhão já lê `unidade_label` da cultura (não é hardcoded no frontend) — o texto "Sacas (60kg)" que aparece vem do banco, não do código.

Faltam no cadastro da cultura: produto, peso por unidade, se permite quantidade de plantas e forma de armazenamento.

## O que será feito

### 1. Banco (script para você aplicar)
Não altero o banco sem sua autorização, então vou entregar um script SQL pronto (sem apagar nada):

- Adicionar colunas em `culturas_config` (todas opcionais, com default):
  `tipo_produto`, `peso_por_unidade`, `permite_quantidade_plantas` (default `true`), `forma_armazenamento`.
- Corrigir as unidades das culturas existentes (Milho e Soja → Toneladas; Café e Abacate permanecem).
- Inserir as culturas novas da sua lista (grãos, frutas, hortaliças, industriais, silvicultura) com unidade, produto, peso por unidade e armazenamento — via `INSERT ... ON CONFLICT DO NOTHING`, sem tocar nas existentes nem nos talhões já cadastrados.
- Atualizar a função `criar_cultura_config` para aceitar os campos novos, mantendo compatibilidade com a chamada atual.

Nenhum talhão, produção ou colheita é alterado: eles seguem apontando para a mesma `cultura_id`, apenas passam a exibir o rótulo correto.

### 2. Formulário do Talhão (`TalhaoForm`)
- Label muda para **"Estimativa de produção (<unidade da cultura>)"**, vindo do banco.
- Sem cultura selecionada: campo desabilitado com placeholder "Selecione uma cultura primeiro".
- Campo **Plantas** só aparece se a cultura tiver `permite_quantidade_plantas = true` (culturas antigas sem a coluna continuam mostrando o campo).
- Dropdown de cultura mostra o ícone/emoji quando houver.
- Validações: estimativa numérica ≥ 0; plantas inteiro positivo; cultura e área obrigatórias.
- Mesmo layout, mesmos componentes, mesma responsividade mobile.

### 3. Diálogo "Nova Cultura" (botão +)
O `+` atual só pede o nome. Passa a abrir um formulário compacto com: nome, ícone, produto produzido, unidade de produção (lista de unidades: Kg, Tonelada, Saca 60kg, m³, Unidade, Litro, Caixa, Cacho, Arroba), peso por unidade (opcional), "permite quantidade de plantas" e forma de armazenamento. Ao salvar, a cultura já aparece selecionada no dropdown.

### 4. Restante do app
Telas de Produção, Colheita, Relatórios e Dashboard já usam `unidade_label`, então passam a mostrar a unidade correta automaticamente — sem mudanças de código.

## Observações técnicas

- Unidade de produção e forma de armazenamento ficam em colunas separadas (não se confundem).
- Conversão para kg fica registrada em `peso_por_unidade` (Saca 60kg = 60; m³ = nulo, sem conversão automática), pronta para a etapa de Produção da Safra / Estoque / Venda.
- O frontend lê as colunas novas de forma tolerante: se o script SQL ainda não tiver sido aplicado, a tela continua funcionando com o comportamento atual.
- Zero regra de cultura hardcoded no frontend; a lista fixa de unidades no diálogo de nova cultura é apenas o vocabulário de unidades, não regra por cultura.
