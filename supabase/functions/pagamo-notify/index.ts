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

type SubmissionRecord = {
  school_year?: number;
  city?: string;
  school_name?: string;
  school_code?: string;
  teacher_name?: string;
  grade?: number;
  class_num?: number;
  student_count?: number;
  subject_chinese?: boolean;
  subject_english?: boolean;
  subject_math?: boolean;
  submitted_at?: string;
};

type SubmitPayload = {
  action?: string;
  records?: SubmissionRecord[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SCHOOL_NAME = "桃園市龍潭區石門國民小學";
const DB_SCHOOL_NAME = "桃園市石門國民小學";
const SCHOOL_CODE = "034725";

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
    if (isSubmitPayload(payload)) {
      return await handleSubmit(payload);
    }

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

async function parsePayload(req: Request): Promise<NotifyPayload | SubmitPayload> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as NotifyPayload | SubmitPayload;
  } catch {
    return { status: "error", message: "Invalid JSON payload" };
  }
}

function isSubmitPayload(payload: NotifyPayload | SubmitPayload): payload is SubmitPayload {
  return "action" in payload && payload.action === "submit_records";
}

async function handleSubmit(payload: SubmitPayload) {
  const records = sanitizeRecords(payload.records || []);
  if (!records.length) {
    return json({ ok: false, error: "No valid submission records." }, 400);
  }

  await upsertRecords(records);
  return json({ ok: true, count: records.length }, 200);
}

function sanitizeRecords(records: SubmissionRecord[]) {
  if (!Array.isArray(records)) return [];

  return records.map((record) => {
    const grade = Number(record.grade);
    const classNum = Number(record.class_num);
    const studentCount = Number(record.student_count);
    const teacherName = String(record.teacher_name || "").trim().slice(0, 80);
    const subjects = [
      Boolean(record.subject_chinese),
      Boolean(record.subject_english),
      Boolean(record.subject_math),
    ].filter(Boolean).length;

    if (!Number.isInteger(grade) || grade < 3 || grade > 6) return null;
    if (!Number.isInteger(classNum) || classNum < 1 || classNum > 30) return null;
    if (!Number.isInteger(studentCount) || studentCount < 1 || studentCount > 80) return null;
    if (!teacherName || subjects < 1 || subjects > 2) return null;

    return {
      school_year: 115,
      city: "桃園市",
      school_name: DB_SCHOOL_NAME,
      school_code: SCHOOL_CODE,
      teacher_name: teacherName,
      grade,
      class_num: classNum,
      student_count: studentCount,
      subject_chinese: Boolean(record.subject_chinese),
      subject_english: Boolean(record.subject_english),
      subject_math: Boolean(record.subject_math),
      submitted_at: new Date().toISOString(),
    };
  }).filter((record): record is Required<SubmissionRecord> => Boolean(record));
}

async function upsertRecords(records: Required<SubmissionRecord>[]) {
  assertSupabaseConfigured();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pagamo_submissions?on_conflict=school_code%2Cgrade%2Cclass_num`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json; charset=utf-8",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(records),
    },
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Failed to save submissions: HTTP ${res.status} ${message}`);
  }
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured.");
  }
}

async function loadWebhook(): Promise<string> {
  assertSupabaseConfigured();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pagamo_private_config?key=eq.google_chat_webhook&select=value`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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
    { label: "學校", text: data.schoolName || SCHOOL_NAME },
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
          subtitle: `${SCHOOL_NAME}｜115 學年度班級授權填報`,
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
