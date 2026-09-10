# Gestão de usuários hierárquica

## Objetivo
Atualizar a administração de usuários para refletir proprietários, propriedades e equipes em uma hierarquia clara, preservando todas as ações existentes.

## Alterações
- Corrigir o diálogo “Aprovar Usuário” para iniciar o papel com `usuarioAprovando.perfil`, mantendo a troca manual.
- Carregar a listagem pela RPC `admin_listar_usuarios_hierarquico` e tratar os grupos `proprietarios` e `sem_propriedade`.
- Exibir cada proprietário como linha expansível com status e quantidade de propriedades.
- Dentro do proprietário expandido, mostrar suas propriedades e a equipe recuada, com badges `propriedade · papel`.
- Manter pessoas sem vínculo como linhas independentes.
- Preservar filtros, busca, detalhes e o menu completo de ações para proprietários e membros.
- Remover a página administrativa “Configuração de Módulos”, sua rota e seus dois atalhos administrativos.
- Não alterar telas comuns nem a lógica de acesso a módulos usada pelo restante do aplicativo.

## Detalhes técnicos
- Normalizar o retorno da RPC para os tipos atuais de usuário, inclusive nomes alternativos de campos e acessos agrupados.
- Reutilizar os mesmos diálogos e handlers de edição, promoção/rebaixamento, suspensão/reativação e exclusão.
- Usar expansão por proprietário sem colocar o menu de ações dentro do acionador de expansão.
- Validar compilação e conferir a tela no navegador após as mudanças.
