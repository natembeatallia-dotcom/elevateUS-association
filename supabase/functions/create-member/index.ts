import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password, fullName, phoneNumber, roleId, joinDate, creditScore, status, notes } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "email, password, and fullName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create the auth user via Admin API
    const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    });

    if (!adminRes.ok) {
      const err = await adminRes.json();
      return new Response(JSON.stringify({ error: err.message || "Failed to create auth user" }), {
        status: adminRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminData = await adminRes.json();
    const userId = adminData.id;

    // Insert the profile row linked to the new auth user
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        full_name: fullName,
        email,
        phone_number: phoneNumber ?? null,
        role_id: roleId ?? 6,
        join_date: joinDate ?? new Date().toISOString().slice(0, 10),
        credit_score: creditScore ?? 500,
        status: status ?? "Active",
        notes: notes ?? null,
        is_system: false,
      }),
    });

    if (!profileRes.ok) {
      // Best-effort cleanup: delete the auth user if profile insert failed
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${serviceRoleKey}`, "apikey": serviceRoleKey },
      });
      const err = await profileRes.json();
      return new Response(JSON.stringify({ error: err.message || "Failed to create profile" }), {
        status: profileRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = await profileRes.json();
    return new Response(JSON.stringify({ user: adminData, profile: profile[0] }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
