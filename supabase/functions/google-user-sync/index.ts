// OPUS — Google Workspace User Sync Edge Function
// Receives Google Workspace Admin push notifications and deactivates deleted/suspended users
//
// Setup no Google Workspace Admin SDK:
// 1. Ative o Google Workspace Admin SDK no Google Cloud Console
// 2. Configure um Channel de notificação push apontando para esta URL
// 3. Configure GOOGLE_SYNC_SECRET no Supabase como token de verificação
//
// Documentação: https://developers.google.com/admin-sdk/reports/v1/guides/push

import { createClient } from "npm:@supabase/supabase-js@2.46.0";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-channel-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify channel token (prevents spoofing)
    const channelToken = req.headers.get("x-goog-channel-token");
    const expectedToken = Deno.env.get("GOOGLE_SYNC_SECRET");
    if (channelToken !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const resourceState = req.headers.get("x-goog-resource-state");

    // Log the event
    await supabase.from("google_sync_log").insert({
      event_type: resourceState ?? "unknown",
      google_email: body.email ?? body.primaryEmail ?? "unknown",
      details: body,
    });

    // Handle user deletion or suspension
    if (
      resourceState === "delete" ||
      body.suspended === true ||
      body.agreedToTerms === false
    ) {
      const email = body.email ?? body.primaryEmail;
      if (email) {
        await supabase.rpc("deactivate_user_by_email", { p_email: email });

        // Update sync log with user reference
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        if (user) {
          await supabase.from("google_sync_log")
            .update({ user_id: user.id })
            .eq("google_email", email)
            .order("processed_at", { ascending: false })
            .limit(1);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Google Sync error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
