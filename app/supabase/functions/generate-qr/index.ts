import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomBytes } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const { entity_type, entity_id } = await req.json();
  const table = entity_type === "driver" ? "drivers" : "guardians";
  const idColumn = entity_type === "driver" ? "driver_id" : "guardian_id";

  const { data: row } = await supabaseAdmin.from(table).select("auth_uid, full_name").eq(idColumn, entity_id).single();
  if (!row) return new Response(JSON.stringify({ error: "غير موجود" }), { status: 404 });

  let authUid = row.auth_uid;
  if (!authUid) {
    const fakeEmail = `${entity_id.toLowerCase()}@buspulse.internal`;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail, email_confirm: true,
      user_metadata: { role: entity_type, full_name: row.full_name },
    });
    if (createErr || !created.user) return new Response(JSON.stringify({ error: "فشل إنشاء الحساب" }), { status: 500 });
    authUid = created.user.id;
    await supabaseAdmin.from("app_users").insert({
      auth_uid: authUid, role: entity_type, full_name: row.full_name,
      [idColumn]: entity_id,
    });
  }

  const newToken = randomBytes(24).toString("hex");
  await supabaseAdmin.from(table).update({ auth_uid: authUid, qr_token: newToken, pin_hash: null }).eq(idColumn, entity_id);

  return new Response(JSON.stringify({
    loginUrl: `https://buspulse-murex.vercel.app/qr-login?t=${newToken}&type=${entity_type}`,
  }), { headers: { "Content-Type": "application/json" } });
});
