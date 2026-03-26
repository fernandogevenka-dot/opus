// OPUS — Atlas Wiki Search Edge Function
// Semantic search using pgvector + RAG with Claude

import Anthropic from "npm:@anthropic-ai/sdk@0.30.0";
import OpenAI from "npm:openai@4.67.0";
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
    const { query } = await req.json() as { query: string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    // 1. Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Search similar chunks in pgvector
    const { data: chunks, error } = await supabase.rpc("search_wiki", {
      query_embedding: queryEmbedding,
      match_count: 5,
      threshold: 0.65,
    });

    if (error) throw new Error(error.message);

    // 3. Fetch page titles for the found chunks
    let sourcePagesRaw: unknown[] = [];
    if (chunks && chunks.length > 0) {
      const pageIds = [...new Set(chunks.map((c: { page_id: string }) => c.page_id))];
      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title, icon")
        .in("id", pageIds);
      sourcePagesRaw = pages ?? [];
    }

    // 4. Build context for RAG
    const context = chunks && chunks.length > 0
      ? chunks.map((c: { chunk: string }) => c.chunk).join("\n\n---\n\n")
      : "Nenhum documento encontrado na base de conhecimento.";

    // 5. Generate answer with Atlas
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: `Você é o Atlas, assistente de IA do OPUS. Responda à pergunta do usuário APENAS com base no contexto fornecido da base de conhecimento. Se o contexto não tiver a resposta, diga isso claramente. Seja conciso e direto.

BASE DE CONHECIMENTO:
${context}`,
      messages: [{ role: "user", content: query }],
    });

    const answer = message.content[0].type === "text" ? message.content[0].text : "";

    return new Response(
      JSON.stringify({ answer, sources: sourcePagesRaw }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, answer: "Erro ao pesquisar.", sources: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
