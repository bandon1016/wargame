import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import WebPush from "npm:web-push";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { userId, title, body, url, type } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: "User ID is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 1. Get user's push subscription and settings
        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("push_subscription, push_settings")
            .eq("id", userId)
            .single();

        if (profileError || !profile) {
            throw new Error(`Profile not found: ${profileError?.message}`);
        }

        const { push_subscription, push_settings } = profile;

        if (!push_subscription) {
            return new Response(JSON.stringify({ message: "User has no push subscription" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 2. Check individual setting
        const settings = push_settings || {};
        const masterEnabled = settings.enabled ?? false;

        let shouldSend = masterEnabled;
        if (masterEnabled && type) {
            const settingKey = `notify${type.charAt(0).toUpperCase() + type.slice(1)}`;
            if (settings[settingKey] === false) {
                shouldSend = false;
            }
        }

        if (!shouldSend) {
            return new Response(JSON.stringify({ message: "Notification disabled by settings" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. Configure web-push with VAPID keys from environment variables
        WebPush.setVapidDetails(
            Deno.env.get("VAPID_EMAIL") || "mailto:example@yourdomain.com",
            Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
            Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
        );

        // 4. Send push notification
        const payload = JSON.stringify({
            title: title || "浪跡戰域",
            body: body || "收到一則新快訊",
            url: url || "/",
        });

        await WebPush.sendNotification(push_subscription, payload);

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("Error sending push:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
