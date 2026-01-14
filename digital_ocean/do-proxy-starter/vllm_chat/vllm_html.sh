#!/usr/bin/env bash
set -e

echo "== Creating chat.html =="

cat << 'EOF' > chat.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>vLLM Chat UI</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f3f4f6;
      --card-bg: #ffffff;
      --border: #e5e7eb;
      --user-bubble: #2563eb;
      --user-text: #ffffff;
      --assistant-bubble: #f3f4f6;
      --assistant-text: #111827;
      --accent: #2563eb;
      --radius-lg: 18px;
      --radius-md: 12px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: stretch;
    }
    .chat-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      width: min(900px, 100vw - 16px);
      height: min(700px, 100vh - 16px);
      margin: 8px;
      overflow: hidden;
    }
    .chat-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
    }
    .chat-header-title { font-weight: 600; font-size: 15px; }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f9fafb;
    }
    .message-row {
      display: flex;
      margin-bottom: 10px;
    }
    .message-row.user { justify-content: flex-end; }
    .message-row.assistant { justify-content: flex-start; }
    .message-bubble {
      max-width: 80%;
      padding: 10px 12px;
      border-radius: var(--radius-lg);
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message-row.user .message-bubble {
      background: var(--user-bubble); color: var(--user-text);
      border-bottom-right-radius: 4px;
    }
    .message-row.assistant .message-bubble {
      background: var(--assistant-bubble); color: var(--assistant-text);
      border-bottom-left-radius: 4px;
    }
    .chat-input-area {
      border-top: 1px solid var(--border);
      padding: 10px 12px;
      background: #f9fafb;
    }
    .chat-input-form { display: flex; gap: 8px; }
    .chat-input {
      flex: 1;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      padding: 8px 10px;
      resize: none;
      font-size: 14px;
    }
    .send-button {
      border-radius: 999px;
      border: none;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      background: var(--accent);
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .typing-indicator { display: none; gap: 4px; font-size: 12px; color: #555; }
    .typing-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #aaa; animation: blink 1s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink {
      0%, 100% { opacity: .2; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-2px); }
    }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <div class="chat-header-title">vLLM Chat UI</div>
    </div>

    <div id="messages" class="chat-messages"></div>

    <div class="chat-input-area">
      <form id="chat-form" class="chat-input-form">
        <textarea id="input" class="chat-input" rows="1"
          placeholder="Send a message..."></textarea>

        <button type="submit" class="send-button" id="send-button">
          Send
        </button>
      </form>
      <div class="typing-indicator" id="typing">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span>Generating...</span>
      </div>
    </div>
  </div>

<script>
  const API_URL = "/api/chat/stream"; // FastAPI streaming proxy
  const MODEL_NAME = "tinyllama/tinyllama-1.1b-chat-v1.0";

  let chatHistory = [];

  const messagesEl = document.getElementById("messages");
  const inputEl = document.getElementById("input");
  const formEl = document.getElementById("chat-form");
  const typingEl = document.getElementById("typing");
  const sendButton = document.getElementById("send-button");

  function addMessage(role, content) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = content;

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(userText) {
    const text = userText.trim();
    if (!text) return;

    addMessage("user", text);
    chatHistory.push({ role: "user", content: text });

    inputEl.value = "";
    sendButton.disabled = true;
    typingEl.style.display = "flex";

    // placeholder for streaming
    let assistantMsg = "";
    const row = document.createElement("div");
    row.className = "message-row assistant";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    row.appendChild(bubble);
    messagesEl.appendChild(row);

    const payload = {
      model: MODEL_NAME,
      messages: chatHistory,
      stream: true,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const dataStr = line.replace("data:", "").trim();
          if (dataStr === "[DONE]") continue;

          try {
            const json = JSON.parse(dataStr);
            const token = json?.choices?.[0]?.delta?.content;
            if (token) {
              assistantMsg += token;
              bubble.textContent = assistantMsg;
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
          } catch {}
        }
      }

      chatHistory.push({ role: "assistant", content: assistantMsg });

    } catch (err) {
      bubble.textContent = "[Error: " + err + "]";
    }

    typingEl.style.display = "none";
    sendButton.disabled = false;
  }


  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.requestSubmit();
    }
  });
</script>
</body>
</html>
EOF

echo "chat.html created."