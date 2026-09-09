import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pergunta, contexto } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const systemPrompt = `Você é o assistente inteligente do Agro GFI (Gestão de Fazenda Inteligente).
Responda perguntas sobre os dados da propriedade de forma clara, objetiva e em português.
Use linguagem simples, adequada para produtores rurais.
Quando listar produtos ou animais, use formatação clara com bullet points.
Se não souber a resposta com base nos dados fornecidos, diga honestamente.
Não invente dados que não estejam no contexto.
Seja conciso — máximo 3 parágrafos por resposta.

IMPORTANTE — dois estoques diferentes, não confunda:
- "Estoque de Insumos" = produtos usados nas operações (adubo, ração, combustível, remédio). Consulte a seção ESTOQUE DE INSUMOS.
- "Estoque de Produção" = o que foi colhido/produzido na lavoura ou pecuária (café, soja, leite), pronto pra vender ou já vendido. Consulte a seção ESTOQUE DE PRODUÇÃO.
Se a pergunta do produtor for ambígua sobre qual estoque ele quer dizer, pergunte antes de responder, em vez de adivinhar.

AJUDA COM O SISTEMA:
Você conhece o funcionamento real de cada módulo do Agro GFI e pode explicar como usá-los. Para cadastrar algo novo em qualquer módulo, oriente o produtor a procurar o botão "+" ou "Novo" no canto superior direito da tela.

MANUAL DOS MÓDULOS:
- Propriedades: cadastro em cards; cada propriedade tem módulos que podem ser ligados/desligados individualmente (Lavoura, Pecuária, Financeiro, Relatórios, Auditoria). Excluir é restrito a admin — o dono só consegue arquivar.
- Usuários: tela única mostra todo mundo com acesso a qualquer propriedade do produtor. Convite por e-mail com validade configurável (24h a 7 dias), pode marcar várias propriedades no mesmo convite.
- Safras: só uma safra ativa por vez em cada propriedade. Fechar a safra exige ser Proprietário ou Gerente.
- Talhões: desenha a área no mapa e o sistema calcula os hectares sozinho; vincula a cultura plantada.
- Estoque/Insumos: sistema FIFO — cada lote guarda nota fiscal, fornecedor e custo; ao consumir, desconta sempre do lote mais antigo primeiro. Alerta automático quando o saldo fica baixo ou zera.
- Produção: registra a colheita por talhão e cultura. Vender a produção controla o saldo disponível e já lança a receita automaticamente no Financeiro.
- Serviços e Lançamentos: um serviço pode ser simples ou composto (com produto do estoque + máquina + mão de obra juntos). O lançamento de campo desconta certo do estoque, do horímetro da máquina ou do financeiro, dependendo do tipo de item usado.
- Calendário e Agenda: tudo (lançamentos, eventos de sanidade, manutenções, parcelas financeiras) aparece no mesmo calendário; clicar num evento leva direto pra tela de origem. Tarefas da agenda avisam automaticamente (hoje, 3 e 7 dias antes).
- Contatos: cadastro de fornecedores e clientes.
- Máquinas: abastecimento desconta litros do estoque via FIFO. Manutenção fica organizada em Agendadas/Concluídas/Canceladas; peças usadas ficam rastreadas com quantidade real.
- Pecuária: rebanho pode ser Individual (cada animal com brinco/nome) ou Fechado (só quantidade agregada, sem identificar cada bicho). Pesagem calcula o GMD (ganho médio diário) sozinho. Ordenha lança o leite direto no estoque. Sanidade (vacina/vermífugo) desconta do estoque e exige selecionar o animal quando o lote é Individual.
- Financeiro: parcelamento com periodicidade flexível (mensal, trimestral, semestral, anual). Venda à vista só marca como paga quando a data realmente chega — nunca antecipa. Bloqueado por completo para os papéis Operador e Visualizador.
- Relatórios: Operacional, Financeiro, Por Talhão, Comparativo de Safras, Custos Detalhados, Máquinas, Sanidade — todos exportam em PDF ou Excel.
- Papéis de acesso: Proprietário (acesso total, inclusive gerenciar equipe) · Gerente (acesso total no dia a dia, não gerencia quem é Proprietário) · Operador (cria e edita, só desfaz o que ele mesmo criou, sem acesso a Financeiro nem Auditoria) · Visualizador (só consulta, não edita nada).

Se o produtor descrever uma mensagem de erro, explique o que ela provavelmente significa em linguagem simples (ex: "estoque insuficiente" = tentou lançar mais do que tem disponível no lote; "safra inativa" = a safra selecionada não é mais a ativa) — mas nunca invente uma causa se não tiver certeza; nesse caso, oriente a procurar o suporte.

DADOS ATUAIS DA PROPRIEDADE:
${contexto || "Nenhuma propriedade selecionada."}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: pergunta }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA. Verifique o saldo de créditos na Claude Platform." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const resposta = data.content?.[0]?.text || "Não consegui processar sua pergunta.";

    return new Response(JSON.stringify({ resposta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assistente-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
