# Agro GFI — Contexto para Claude Code

Sistema ERP multi-tenant agrícola (lavoura + pecuária) para produtores
"café com leite" do Sul de Minas / Alta Mogiana. Fundador solo: Marco.
Fase atual: **manutenção**, não criação de tela nova salvo indicação explícita.

## Stack
- Frontend: React 18 + TypeScript + Vite + shadcn-ui, React Query, Recharts, react-leaflet
- Backend: Supabase Postgres (São Paulo) — RLS em quase toda tabela, RPCs, triggers, Edge Functions Deno
- Deploy: push em `main` → GitHub → Vercel auto-deploy em app.agrogfi.com.br
- Lovable fica conectado via sync do GitHub mas NÃO é usado nesta fase para autorar mudanças

## Regras de negócio que já causaram bug quando ignoradas
- **FIFO de estoque**: o frontend é a fonte de verdade do consumo de lote.
  Os triggers de banco que faziam isso foram removidos de propósito — não recriar.
- **Custo operacional (lançamentos) e fluxo de caixa (financeiro) são separados.**
  Nunca somar os dois como se fossem despesas independentes — já causou
  contagem em dobro em várias RPCs/views no passado.
- **Categorias de produto/serviço**: a tabela usa `usuario_id` (quem criou) E
  `dono_id` (dono da propriedade, usado pelo filtro de leitura). Qualquer
  INSERT que esqueça `dono_id` cria categoria invisível — já aconteceu.
- **Inputs numéricos controlados**: nunca usar `value={estado || ''}` em campo
  de número — `0` é falsy em JS e apaga o campo no meio da digitação. Usar
  estado de texto separado do valor numérico calculado.

## Antes de mexer no banco
- Trocar assinatura/retorno de uma função Postgres: sempre `DROP FUNCTION IF EXISTS`
  com a assinatura antiga completa antes de recriar, senão o Postgres cria uma
  sobrecarga duplicada e a chamada fica ambígua silenciosamente.
- Testar RLS de verdade, nunca como superuser:
```sql
  BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"[uuid]","role":"authenticated"}';
  -- query aqui
  ROLLBACK;
```
  Rodar via `execute_sql` direto ignora RLS (bypassa como superuser) — não serve
  pra validar controle de acesso.

## Fluxo de trabalho esperado
1. Ler o(s) arquivo(s) relevante(s) antes de propor qualquer edição — nunca
   assumir conteúdo de memória.
2. Mudança estrutural ou de regra de negócio: perguntar antes de aplicar.
3. Depois de editar, rodar `npm run build` (ou `tsc --noEmit`) antes de considerar pronto.
4. Nunca commitar sozinho — Marco revisa o diff e decide.
5. Conta de teste: marco.luz1994@gmail.com — validar ali antes de dar como concluído.

## Onde NÃO alucinar — perguntar em vez de assumir
- Preço de plano, limite de hectare/usuário: está em definição, não confiar em
  valor visto no código sem confirmar que é o vigente.
- Qualquer coisa envolvendo cobrança/assinatura: hoje é 100% manual, sem gateway.