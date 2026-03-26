// OPUS — Renews Google Workspace push notification channel every 6 days
// Called by Supabase cron job

import { GoogleAuth } from "npm:google-auth-library@9.14.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceAccountJson = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
    const syncSecret = Deno.env.get("GOOGLE_SYNC_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const auth = new GoogleAuth({
      credentials: serviceAccountJson,
      scopes: ["https://www.googleapis.com/auth/admin.reports.audit.readonly"],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // Register/renew the push notification channel
    const response = await fetch(
      "https://admin.googleapis.com/admin/reports/v1/activity/watch/all/admin",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `opus-user-sync-${Date.now()}`,
          type: "web_hook",
          address: `${supabaseUrl}/functions/v1/google-user-sync`,
          token: syncSecret,
          expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
      }
    );

    const result = await response.json();

    return new Response(
      JSON.stringify({ renewed: true, channel: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
