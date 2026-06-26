const WEBHOOK_PROP = 'GOOGLE_CHAT_WEBHOOK';

function doPost(e) {
  try {
    const data = parsePayload_(e);
    const payload = buildChatPayload_(data);
    const code = pushChat_(payload);
    return json_({ ok: code >= 200 && code < 300, code });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  const hasWebhook = Boolean(getWebhook_());
  return json_({ ok: true, service: 'pagamo-chat-notifier', hasWebhook });
}

function setGoogleChatWebhookForSetup(url) {
  if (!url || !String(url).trim()) throw new Error('Webhook URL is required.');
  var rawUrl = String(url).trim();
  var webhookUrl = rawUrl.indexOf('https%3A') === 0 ? decodeURIComponent(rawUrl) : rawUrl;
  PropertiesService.getScriptProperties().setProperty(WEBHOOK_PROP, webhookUrl);
  const code = pushChat_(buildChatPayload_({
    status: 'success',
    step: 'Google Chat 通知代理已完成設定',
    message: '之後填報成功或失敗都會推送到這個聊天室。',
    schoolName: '桃園市石門國民小學',
  }));
  return { ok: code >= 200 && code < 300, code };
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return { status: 'error', message: 'Invalid JSON payload' };
  }
}

function getWebhook_() {
  return (PropertiesService.getScriptProperties().getProperty(WEBHOOK_PROP) || '').trim();
}

function pushChat_(payload) {
  const url = getWebhook_();
  if (!url) throw new Error('GOOGLE_CHAT_WEBHOOK is not configured.');

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return res.getResponseCode();
}

function buildChatPayload_(data) {
  const status = data.status === 'success' ? 'success' : 'error';
  const title = status === 'success'
    ? '✅ PaGamO 校內填報成功'
    : '⚠️ PaGamO 校內填報失敗';
  const subtitle = '桃園市石門國民小學｜115 學年度班級授權填報';
  const color = status === 'success' ? '#16a34a' : '#dc2626';
  const summary = status === 'success'
    ? `成功送出 ${data.classCount || 0} 個班級需求`
    : (data.message || '使用者操作時發生錯誤');

  const rows = [
    { label: '狀態', text: status === 'success' ? '成功' : '失敗' },
    { label: '進度', text: data.step || (status === 'success' ? '資料已寫入 Supabase' : '資料送出未完成') },
    { label: '學校', text: data.schoolName || '桃園市石門國民小學' },
    { label: '時間', text: data.time || new Date().toISOString() },
  ];

  if (data.teacherNames) rows.push({ label: '申請老師', text: data.teacherNames });
  if (data.detail) rows.push({ label: '填報內容', text: data.detail });
  if (data.pageUrl) rows.push({ label: '頁面', text: data.pageUrl });

  return {
    text: title + '｜' + summary,
    cardsV2: [{
      cardId: 'pagamo-' + Date.now(),
      card: {
        header: {
          title,
          subtitle,
        },
        sections: [{
          widgets: [
            { textParagraph: { text: `<font color="${color}"><b>${escapeChat_(summary)}</b></font>` } },
          ].concat(rows.map(function (row) {
            return {
              decoratedText: {
                topLabel: row.label,
                text: escapeChat_(row.text),
                wrapText: true,
              },
            };
          })),
        }],
      },
    }],
  };
}

function escapeChat_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
