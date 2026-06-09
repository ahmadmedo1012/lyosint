import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "10000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "";

async function getWebhookInfo() {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    return (await res.json()) as { ok: boolean; result?: { url: string } };
  } catch { return null; }
}

async function setTelegramWebhook() {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, skipping webhook setup");
    return;
  }

  let webhookUrl = PUBLIC_URL ? `${PUBLIC_URL}/api/auth/bot-webhook` : "";

  if (!webhookUrl) {
    const info = await getWebhookInfo();
    if (info?.ok && info.result?.url) {
      logger.info({ url: info.result.url }, "Telegram webhook already configured");
      return;
    }
    logger.error("PUBLIC_URL not set — set it in Render env vars (e.g. https://lyosint.onrender.com)");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook set successfully");
    } else {
      logger.error({ error: data.description }, "Failed to set Telegram webhook");
    }
  } catch (err) {
    logger.error(err, "Error setting Telegram webhook");
  }
}

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  await setTelegramWebhook();
});

process.on("SIGTERM", () => {
  server.close(() => logger.info("Server closed"));
});
