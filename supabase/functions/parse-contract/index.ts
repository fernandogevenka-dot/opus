// OPUS — Parse Contract Edge Function
// Reads a PDF contract from Supabase Storage and extracts contracted products using Claude

import Anthropic from "npm:@anthropic-ai/sdk@0.30.0";
import { createClient } from "npm:@supabase/supabase-js@2.46.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExtractedProduct {
  product: string;
  description: string;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contract_id } = await req.json() as { contract_id: string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    // 1. Fetch contract record
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("*, client:clients(name)")
      .eq("id", contract_id)
      .single();

    if (contractError || !contract) {
      throw new Error("Contrato não encontrado");
    }

    // 2. Download PDF from Supabase Storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("contracts")
      .download(contract.file_path);

    if (fileError || !fileData) {
      throw new Error("Erro ao baixar o arquivo do contrato");
    }

    // 3. Convert PDF to base64 for Claude
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 4. Send to Claude for extraction
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analise este contrato e extraia TODOS os produtos e serviços contratados.

Para cada produto/serviço retorne um JSON array com este formato exato:
[
  {
    "product": "Nome do produto ou serviço",
    "description": "Descrição detalhada do que inclui",
    "value": 1500.00,
    "start_date": "2026-01-01",
    "end_date": "2027-01-01"
  }
]

Regras:
- value deve ser o valor MENSAL em reais (número sem símbolo)
- Se não encontrar valor, use null
- Se não encontrar data, use null
- Datas no formato YYYY-MM-DD
- Extraia TODOS os produtos, mesmo que sejam itens de um pacote
- Responda APENAS com o JSON array, sem texto adicional`,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

    // 5. Parse extracted products
    let products: ExtractedProduct[] = [];
    try {
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, "");
      products = JSON.parse(cleanJson);
    } catch {
      throw new Error("Falha ao parsear produtos extraídos pelo Claude");
    }

    // 6. Save products to DB
    if (products.length > 0) {
      const productRows = products.map((p) => ({
        client_id: contract.client_id,
        product: p.product,
        description: p.description ?? "",
        value: p.value,
        start_date: p.start_date,
        end_date: p.end_date,
        source: "contract_ai",
        contract_id,
        status: "active",
      }));

      await supabase.from("contracted_products").insert(productRows);
    }

    // 7. Update contract as parsed
    await supabase
      .from("contracts")
      .update({
        products_parsed: true,
        parsed_at: new Date().toISOString(),
        extracted_text: responseText,
      })
      .eq("id", contract_id);

    // 8. Auto-update client MRR from products
    const totalMrr = products.reduce((sum, p) => sum + (p.value ?? 0), 0);
    if (totalMrr > 0) {
      await supabase
        .from("clients")
        .update({ mrr: totalMrr, arr: totalMrr * 12, updated_at: new Date().toISOString() })
        .eq("id", contract.client_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products_count: products.length,
        products,
        total_mrr: totalMrr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
