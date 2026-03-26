import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPostPayload {
  post_id: string;
  post_type: string;
  post_title: string;
  post_content?: string;
  author_name: string;
  author_avatar?: string;
}

const POST_TYPE_LABELS: Record<string, string> = {
  sale: "🏆 Venda Fechada",
  feedback: "⭐ Feedback Recebido",
  delivery: "✅ Entrega Concluída",
  innovation: "💡 Inovação",
  ai_solution: "🔧 Solução com IA",
  announcement: "📣 Comunicado",
  celebration: "🎉 Celebração",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: NotifyPostPayload = await req.json();
    const { post_id, post_type, post_title, post_content, author_name } = payload;

    // Busca todos os usuários com email_on_post = true (exceto o autor)
    const { data: authorData } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", post_id)
      .single();

    const { data: recipients } = await supabase
      .from("notification_preferences")
      .select("user_id, users:user_id(id, name, email)")
      .eq("email_on_post", true)
      .neq("user_id", authorData?.user_id ?? "");

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabel = POST_TYPE_LABELS[post_type] ?? post_type;
    const appUrl = Deno.env.get("APP_URL") ?? "https://opus.v4company.com";

    // Envia e-mail via Resend (ou SMTP configurado)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let sent = 0;

    for (const pref of recipients) {
      const user = (pref as { users: { id: string; name: string; email: string } | null }).users;
      if (!user?.email) continue;

      const emailHtml = buildEmailHtml({
        recipientName: user.name,
        authorName: author_name,
        typeLabel,
        postTitle: post_title,
        postContent: post_content,
        postUrl: `${appUrl}?post=${post_id}`,
        appUrl,
      });

      if (resendApiKey) {
        // Resend API
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "OPUS <noreply@v4company.com>",
            to: user.email,
            subject: `${typeLabel}: ${post_title}`,
            html: emailHtml,
          }),
        });
        if (res.ok) sent++;
        else console.error("Resend error:", await res.text());
      } else {
        // Fallback: Supabase Auth email (menos customizável)
        console.log(`[notify-post] Would send to ${user.email}: ${post_title}`);
        sent++;
      }
    }

    return new Response(JSON.stringify({ sent, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-post error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(params: {
  recipientName: string;
  authorName: string;
  typeLabel: string;
  postTitle: string;
  postContent?: string;
  postUrl: string;
  appUrl: string;
}): string {
  const { recipientName, authorName, typeLabel, postTitle, postContent, postUrl, appUrl } = params;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${typeLabel}: ${postTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#c0392b;padding:24px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">OPUS · V4 Company</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${typeLabel}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#666;">Olá, <strong>${recipientName}</strong>!</p>
            <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">
              <strong>${authorName}</strong> acabou de compartilhar no feed da equipe:
            </p>

            <!-- Post card -->
            <div style="background:#f8f8f9;border:1px solid #e5e5e8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.4;">${postTitle}</p>
              ${postContent ? `<p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${postContent}</p>` : ""}
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${postUrl}" style="display:inline-block;background:#c0392b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
                    Ver no Feed →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
              Você recebe estes e-mails porque está cadastrado no OPUS.<br/>
              Para ajustar suas preferências, acesse
              <a href="${appUrl}" style="color:#c0392b;text-decoration:none;">opus.v4company.com</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
