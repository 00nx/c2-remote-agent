# 💻 Telegram-Controlled C2 Agent

A lightweight **Command & Control (C2)** system using **WebSocket** and **Telegram bot** integration to remotely manage and deploy tasks to connected client systems. The client is a stealthy, background-only agent that can be compiled using **Electron**.

---

> [!CAUTION]
> **This framework is for educational and authorized red team purposes only, a sample template for C2 server controlled through telegram.**
> **Running such systems on devices you do not own or have explicit permission to control is illegal and unethical.**
> **Use this at your own risk, i am not **responsible** for any misuse**

## 🚀 Features

-  **Pure WebSocket** communication between server and clients
-  **Telegram bot interface** to control and manage connected agents
-  **Electron-based executor** for compiling cross-platform stealth clients
-  **No GUI** — designed to run silently in the background
-  Supports remote **download and execution** of payloads
-  Live tracking of active/inactive systems
-  Persistent system registry via `systems.json`

---

## 📁 Project Structure

```shell


├── ELECTRON/ 
│ └── main.js
├── server/
│ ├── bot.js 
│ ├── server.js r
│ ├── systems.json 
│ └── config.json
├── package.json 
└── README.md 

```


---

## 🛠️ Requirements

- Node.js ≥ 18.x
- npm or yarn
- Telegram bot token & private channel ID
- (Optional) Electron Builder / Packager for compiling the client

---

## ⚙️ Setup & Usage

### 1. 📦 Install Dependencies

```bash
npm install
```

2. 🛠 Configure config.json
Create a config.json file in the root with the following structure:
```bash
{
  "telegram_token": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegram_chat_id": -1234567890,
  "download_url": "https://yourdomain.com/download/payload.exe"
}
```

3. 🤖 Start the server + Bot
```bash
npm run start
```
This will launch the WebSocket server on **ws://localhost:3010/ws**
Once running, you can interact with the bot in your configured private Telegram channel.

4. 🛰 Compile the Client (Electron)
Navigate to the ELECTRON/ directory and run:
```bash
electron-builder --win-portable
```
⚠️ The client runs silently in the background with no window or GUI.



💬 Telegram Bot Commands :
**/start**	Displays total + active systems
- 🔍 Show Active	Lists active connected clients
- 🔁 Reinject	Allows you to select a client to send a new payload

  

