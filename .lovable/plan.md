# Lançamentos consecutivos sem sair da tela

## O que será alterado
- Na criação de um lançamento, manter a pessoa na tela após salvar, exibir “Lançamento salvo!” e limpar o formulário para o próximo registro.
- Registrar os lançamentos salvos durante a sessão em uma seção “Lançamentos feitos agora”, do mais recente ao mais antigo, com horário, serviço, talhão/propriedade e custo total.
- Adicionar “+ Novo Lançamento” no cabeçalho. Se houver dados não salvos, pedir confirmação antes de limpar; se estiver vazio, limpar imediatamente.
- Preservar o comportamento atual de sair pelos botões Voltar e Cancelar.
- Preservar o fluxo de edição: salvar alterações continua retornando à lista, evitando transformar uma edição em novo cadastro.

## Detalhes técnicos
- Centralizar a limpeza em uma função de reset que restaura a data local de hoje e zera serviço, talhão, observações, itens e estados auxiliares de seleção.
- Capturar os nomes e o custo calculado antes do reset, garantindo que o histórico visual mostre exatamente o lançamento salvo.
- Usar `AlertDialog` para a confirmação de descarte e os componentes visuais já existentes no projeto.
- Validar tipos e o build ao final.
