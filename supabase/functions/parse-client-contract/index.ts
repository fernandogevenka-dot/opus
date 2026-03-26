// parse-client-contract — Extrai dados do CONTRATANTE a partir do PDF do contrato via Claude

import Anthropic from "npm:@anthropic-ai/sdk@0.30.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExtractedClient {
  name: string | null;
  razao_social: string | null;
  cnpj: string | null;
  contact_name: string | null;
  contact_email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  mrr: number | null;
  operation_start_date: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64 }: { pdf_base64: string } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "pdf_base64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf_base64,
              },
            },
            {
              type: "text",
              text: `Analise este contrato e extraia os dados do CONTRATANTE (o cliente que está contratando o serviço, NÃO a empresa prestadora de serviço/contratada).

Retorne SOMENTE um JSON válido com este formato exato (sem texto antes ou depois):
{
  "name": "Nome comercial ou fantasia da empresa contratante",
  "razao_social": "Razão social completa com LTDA, SA, MEI etc",
  "cnpj": "XX.XXX.XXX/XXXX-XX",
  "contact_name": "Nome do representante legal ou responsável assinante",
  "contact_email": "email do contratante (não da contratada)",
  "telefone": "telefone se encontrado",
  "cidade": "cidade da sede do contratante",
  "estado": "UF de 2 letras",
  "mrr": 1500.00,
  "operation_start_date": "YYYY-MM-DD"
}

Regras:
- name: use o nome fantasia se existir, senão a razão social
- mrr: valor mensal recorrente em reais (número puro, sem símbolo). Se for pagamento único, divida pelo número de meses. Se não houver recorrência, use o valor total
- operation_start_date: data de início do escopo/serviço no formato YYYY-MM-DD
- Use null para qualquer campo não encontrado
- Responda APENAS com o JSON, sem markdown, sem explicações`,
            },
          ],
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    let extracted: ExtractedClient;
    try {
      const clean = responseText.replace(/```json\n?|\n?```/g, "").trim();
      extracted = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({ error: "Claude retornou formato inválido", raw: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
