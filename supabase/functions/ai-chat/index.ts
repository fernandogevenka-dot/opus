// Oxicore — AI proxy Edge Function
// Pass-through genérico para Anthropic API (streaming e não-streaming)
// Aceita: { messages, system?, model?, max_tokens?, stream? }
// messages.content pode ser string ou array multimodal (documentos, imagens, etc.)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const body = await req.json();

    // Suporte legado: { messages: [{role, content: string}], system }
    // Suporte novo:   payload completo Anthropic passado direto
    const payload = {
      model: body.model ?? "claude-opus-4-6",
      max_tokens: body.max_tokens ?? 4096,
      stream: body.stream ?? false,
      ...(body.system ? { system: body.system } : {}),
      messages: body.messages,
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: `Anthropic error ${anthropicRes.status}`, detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Não-streaming: retorna JSON direto
    if (!payload.stream) {
      const json = await anthropicRes.json();
      return new Response(JSON.stringify(json), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming: re-transmite SSE traduzindo para formato OpenAI-compat
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                ) {
                  const out = JSON.stringify({
                    choices: [{ delta: { content: parsed.delta.text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${out}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
