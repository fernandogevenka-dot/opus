// OPUS — Upload & Parse Survey Edge Function
// Accepts CSV/PDF survey uploads, extracts scores using Claude, and saves to DB

import Anthropic from "npm:@anthropic-ai/sdk@0.30.0";
import { createClient } from "npm:@supabase/supabase-js@2.46.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file         = formData.get("file") as File | null;
    const client_id    = formData.get("client_id") as string;
    const survey_type  = (formData.get("type") as string) ?? "nps";
    const period       = formData.get("period") as string;
    const respondent   = formData.get("respondent") as string;
    const applied_by   = formData.get("applied_by") as string;

    if (!file || !client_id) {
      return new Response(JSON.stringify({ error: "Missing file or client_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    // 1. Upload file to Supabase Storage
    const filePath = `surveys/${client_id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("surveys")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

    // 2. Read file content for analysis
    let fileContent = "";
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      fileContent = await file.text();
    } else if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      // Use Claude's document vision for PDF
      const message = await anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extraia todas as respostas desta pesquisa de satisfação. Retorne como texto estruturado." },
          ],
        }],
      });
      fileContent = message.content[0].type === "text" ? message.content[0].text : "";
    }

    // 3. Use Claude to extract score and answers
    const extractMessage = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analise esta pesquisa de satisfação do tipo "${survey_type}" e extraia:

CONTEÚDO DA PESQUISA:
${fileContent.slice(0, 3000)}

Retorne APENAS um JSON com este formato:
{
  "score": 8.5,
  "title": "Pesquisa NPS - Jan 2026",
  "answers": {
    "pergunta_1": "resposta_1",
    "pontos_positivos": "...",
    "pontos_melhoria": "..."
  },
  "summary": "Resumo em 2 frases do feedback principal"
}

Para NPS: score de -100 a 100
Para CSAT: score de 1 a 5
Para CES: score de 1 a 7`,
      }],
    });

    const extractText = extractMessage.content[0].type === "text" ? extractMessage.content[0].text.trim() : "{}";
    let extracted: { score?: number; title?: string; answers?: Record<string, string>; summary?: string } = {};
    try {
      extracted = JSON.parse(extractText.replace(/```json\n?|\n?```/g, ""));
    } catch {
      extracted = { score: 0, title: `Pesquisa ${period}`, answers: {}, summary: "" };
    }

    // 4. Save survey to DB
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        client_id,
        title: extracted.title ?? `Pesquisa ${survey_type.toUpperCase()} - ${period}`,
        type: survey_type,
        period,
        score: extracted.score,
        respondent,
        answers: { ...extracted.answers, summary: extracted.summary },
        file_path: filePath,
        applied_by,
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (surveyError) throw new Error(surveyError.message);

    // 5. Update client NPS/CSAT
    if (survey_type === "nps" && extracted.score !== undefined) {
      const npsNormalized = Math.round(((extracted.score + 100) / 200) * 10);
      await supabase.from("clients")
        .update({ nps: Math.min(10, Math.max(0, npsNormalized)), updated_at: new Date().toISOString() })
        .eq("id", client_id);
    } else if (survey_type === "csat" && extracted.score !== undefined) {
      await supabase.from("clients")
        .update({ csat: extracted.score, updated_at: new Date().toISOString() })
        .eq("id", client_id);
    }

    return new Response(
      JSON.stringify({ success: true, survey, extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
