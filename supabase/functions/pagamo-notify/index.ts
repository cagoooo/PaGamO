type NotifyPayload = {
  status?: string;
  step?: string;
  message?: string;
  schoolName?: string;
  pageUrl?: string;
  time?: string;
  classCount?: number;
  teacherNames?: string;
  detail?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedOrigins = new Set([
  "https://cagoooo.github.io",
  "https://lungtan-dfc-2026.web.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true }, 200);
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) {
    return json({ ok: false, error: "Origin not allowed" }, 403);
  }

  try {
    const payload = await parsePayload(req);
    const webhook = await loadWebhook();
    const chatResponse = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(buildChatPayload(payload)),
    });

    if (!chatResponse.ok) {
      return json({ ok: false, code: chatResponse.status }, 502);
    }

    return json({ ok: true, code: chatResponse.status }, 200);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function parsePayload(req: Request): Promise<NotifyPayload> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as NotifyPayload;
  } catch {
    return { status: "error", message: "Invalid JSON payload" };
  }
}

async function loadWebhook(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured.");
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/pagamo_private_config?key=eq.google_chat_webhook&select=value`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!res.ok) throw new Error(`Failed to load webhook: HTTP ${res.status}`);
  const rows = await res.json() as Array<{ value?: string }>;
  const webhook = rows[0]?.value?.trim();
  if (!webhook) throw new Error("Google Chat webhook is not configured.");
  return webhook;
}

function buildChatPayload(data: NotifyPayload) {
  const isSuccess = data.status === "success";
  const title = isSuccess ? "PaGamO 校內填報成功" : "PaGamO 校內填報失敗";
  const summary = isSuccess
    ? `成功送出 ${data.classCount || 0} 個班級需求`
    : data.message || "使用者操作時發生錯誤";
  const color = isSuccess ? "#16a34a" : "#dc2626";
  const rows = [
    { label: "狀態", text: isSuccess ? "成功" : "失敗" },
    { label: "進度", text: data.step || (isSuccess ? "資料已寫入 Supabase" : "資料送出未完成") },
    { label: "學校", text: data.schoolName || "桃園市石門國民小學" },
    { label: "時間", text: data.time || new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) },
  ];

  if (data.teacherNames) rows.push({ label: "申請老師", text: data.teacherNames });
  if (data.detail) rows.push({ label: "填報內容", text: data.detail });
  if (data.pageUrl) rows.push({ label: "頁面", text: data.pageUrl });

  return {
    text: `${title}｜${summary}`,
    cardsV2: [{
      cardId: `pagamo-${Date.now()}`,
      card: {
        header: {
          title: isSuccess ? `✅ ${title}` : `⚠️ ${title}`,
          subtitle: "桃園市石門國民小學｜115 學年度班級授權填報",
        },
        sections: [{
          widgets: [
            { textParagraph: { text: `<font color="${color}"><b>${escapeChat(summary)}</b></font>` } },
            ...rows.map((row) => ({
              decoratedText: {
                topLabel: row.label,
                text: escapeChat(row.text),
                wrapText: true,
              },
            })),
          ],
        }],
      },
    }],
  };
}

function escapeChat(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
