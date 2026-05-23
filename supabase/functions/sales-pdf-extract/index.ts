// sales-pdf-extract — extrai campos SPICED de um FPS SQL em PDF
// Recebe: { base64: string, mediaType: string }
// Retorna: JSON com os campos do formulário

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACTION_PROMPT = `Extraia as informações deste FPS SQL (Formulário de Pré-Qualificação de Vendas) e retorne SOMENTE um JSON válido com estes campos (use string vazia "" se não encontrar):
{
  "empresa": "nome da empresa prospect",
  "segmento": "segmento/setor da empresa",
  "porte": "porte ou tamanho da empresa",
  "website": "site ou instagram ou linkedin mencionado",
  "decisores": "nomes dos decisores mapeados",
  "situacao": "conteúdo do campo S - Situação (SPICED)",
  "problema": "conteúdo do campo P - Problema (SPICED)",
  "impacto": "conteúdo do campo I - Impacto (SPICED)",
  "critical_event": "conteúdo do campo C - Critical Event ou Evento Crítico (SPICED)",
  "decisao": "conteúdo do campo D/E - Decisão (SPICED)",
  "marketing_atual": "diagnóstico de marketing atual mencionado",
  "vendas_atual": "diagnóstico de vendas atual mencionado",
  "budget_estimado": "budget ou investimento mencionado",
  "origem_lead": "como chegou o lead ou origem da prospecção",
  "observacoes_closer": "observações para o closer mencionadas"
}
Retorne APENAS o JSON, sem markdown, sem explicação.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { base64, mediaType } = await req.json() as {
      base64: string;
      mediaType?: string;
    };

    if (!base64) {
      return new Response(
        JSON.stringify({ error: "Missing base64 field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const docType = mediaType ?? "application/pdf";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: docType, data: base64 },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: `Anthropic error ${anthropicRes.status}`, detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await anthropicRes.json();
    const rawText: string = json.content?.[0]?.text ?? "{}";

    // Parse JSON — tolerante a markdown fences
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* return empty */ }
      }
    }

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
