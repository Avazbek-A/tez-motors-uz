#!/usr/bin/env node
/**
 * Register the Telegram bot's command menus (the "/" list + the Menu button).
 *
 * Run once after deploy (and whenever the command set changes):
 *   node scripts/set-bot-commands.mjs
 *
 * Reads TELEGRAM_BOT_TOKEN, TELEGRAM_OPERATOR_CHAT_IDS and NEXT_PUBLIC_SITE_URL
 * from the environment, falling back to ./.env.local (reading only the keys it
 * needs — it does NOT source the file, which can contain shell-unsafe lines).
 *
 * Clients get a localized (ru/uz/en) command list under the default scope;
 * operator chats (TELEGRAM_OPERATOR_CHAT_IDS) get a separate dealer command set
 * under the per-chat scope, which overrides the default for those chats.
 */
import { readFileSync } from "node:fs";

function fromEnvFile(key) {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "").replace(/\r$/, "") : "";
  } catch {
    return "";
  }
}
const cfg = (key) => process.env[key] || fromEnvFile(key);

const TOKEN = cfg("TELEGRAM_BOT_TOKEN");
const OPERATORS = cfg("TELEGRAM_OPERATOR_CHAT_IDS").split(",").map((s) => s.trim()).filter(Boolean);
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN not set (env or .env.local) — aborting.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`${method}${body.language_code ? `[${body.language_code}]` : ""}${body.scope?.chat_id ? `[chat ${body.scope.chat_id}]` : ""} -> ${json.ok ? "ok" : "FAIL " + JSON.stringify(json)}`);
  return json.ok;
}

// ---- Client commands (default scope, localized) ----------------------------
const CLIENT = {
  ru: [
    ["start", "Запустить бота / главное меню"],
    ["menu", "Главное меню"],
    ["catalog", "Каталог авто"],
    ["customs", "Калькулятор растаможки"],
    ["track", "Статус моего заказа"],
    ["contacts", "Контакты и адрес"],
    ["language", "Сменить язык"],
    ["help", "Помощь"],
  ],
  uz: [
    ["start", "Botni ishga tushirish / bosh menyu"],
    ["menu", "Bosh menyu"],
    ["catalog", "Avto katalogi"],
    ["customs", "Rastamojka kalkulyatori"],
    ["track", "Buyurtmam holati"],
    ["contacts", "Kontaktlar va manzil"],
    ["language", "Tilni o'zgartirish"],
    ["help", "Yordam"],
  ],
  en: [
    ["start", "Start the bot / main menu"],
    ["menu", "Main menu"],
    ["catalog", "Car catalog"],
    ["customs", "Customs calculator"],
    ["track", "My order status"],
    ["contacts", "Contacts & address"],
    ["language", "Change language"],
    ["help", "Help"],
  ],
};

// ---- Operator commands (per-chat scope, Russian) ---------------------------
const OPERATOR = [
  ["menu", "Панель оператора"],
  ["summary", "Сводка за день"],
  ["money", "Деньги и выручка"],
  ["demand", "Спрос"],
  ["aging", "Что залежалось"],
  ["leads", "Новые заявки"],
  ["help", "Как пользоваться"],
];

const toCmds = (pairs) => pairs.map(([command, description]) => ({ command, description }));

async function main() {
  // Default scope: a language-neutral fallback (ru) + explicit ru/uz/en.
  await call("setMyCommands", { commands: toCmds(CLIENT.ru), scope: { type: "default" } });
  for (const lang of ["ru", "uz", "en"]) {
    await call("setMyCommands", { commands: toCmds(CLIENT[lang]), scope: { type: "default" }, language_code: lang });
  }

  // Operator chats override the default with the dealer command set.
  for (const chatId of OPERATORS) {
    await call("setMyCommands", { commands: toCmds(OPERATOR), scope: { type: "chat", chat_id: Number(chatId) } });
  }

  // The bottom-left Menu button shows the command list (most discoverable).
  await call("setChatMenuButton", { menu_button: { type: "commands" } });

  console.log(`\nDone. Client commands in ru/uz/en; operator commands for ${OPERATORS.length} chat(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
