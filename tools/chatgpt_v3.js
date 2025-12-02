#!/usr/bin/env node

// =====================================
// Imports
// =====================================
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

// =====================================
 // Configuration
// =====================================
const API_KEY = process.env.OPENAI_API_KEY;
const ACTIVE_MODEL = "gpt-4.1-mini"; // Change if needed
const CONV_DIR = path.join(os.homedir(), "chatgpt_conversations");
const PAGE_LINES = 15; // lines per page when scrolling long output

// ANSI Colors
const COLOR_USER = "\x1b[1;34m";
const COLOR_GPT = "\x1b[1;32m";
const COLOR_HEADER = "\x1b[1;33m";
const COLOR_RESET = "\x1b[0m";
const COLOR_BOLD = "\x1b[1m";
const COLOR_DIM = "\x1b[2m";
const COLOR_UNDER = "\x1b[4m";
const COLOR_CODE = "\x1b[7m"; // reverse video

if (!fs.existsSync(CONV_DIR)) {
  fs.mkdirSync(CONV_DIR, { recursive: true });
}

// =====================================
// Utility: readline helpers
// =====================================
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

// =====================================
// API Helpers
// =====================================

async function getAvailableModels() {
  try {
    const resp = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!resp.ok) {
      return ["(unavailable)"];
    }

    const data = await resp.json();
    const models = (data.data || []).map((m) => m.id);
    return models.sort();
  } catch {
    return ["(unavailable)"];
  }
}

function groupModelNames(modelList) {
  const groups = {};
  for (const name of modelList) {
    const parts = name.split("-");
    const key = parts.length >= 2 ? parts.slice(0, 2).join("-") : name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(name);
  }

  const formatted = [];
  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 1) {
      formatted.push(`${key}(${items.length})`);
    } else {
      formatted.push(key);
    }
  }
  return formatted.sort().join(", ");
}

// =====================================
// Conversation helpers
// =====================================

function listConversations() {
  const files = fs
    .readdirSync(CONV_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(CONV_DIR, f))
    .sort();
  return files.slice(-10);
}

function listSavedConversations() {
  return fs
    .readdirSync(CONV_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function loadConversation(num) {
  const files = listSavedConversations();
  if (num < 1 || num > files.length) {
    return { messages: null, filename: null };
  }
  const filename = files[num - 1];
  const fullPath = path.join(CONV_DIR, filename);
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(raw);
    const messages = data.messages || [];
    return { messages, filename };
  } catch {
    return { messages: null, filename: null };
  }
}

function saveConversation(messages) {
  const title = "conversation";
  const existing = listSavedConversations();
  const index = existing.length + 1;
  const filename = `${String(index).padStart(3, "0")}-${title}.json`;
  const fullPath = path.join(CONV_DIR, filename);

  fs.writeFileSync(
    fullPath,
    JSON.stringify({ messages }, null, 2),
    "utf8"
  );
}

// =====================================
// Markdown Rendering
// =====================================

function renderMarkdown(text) {
  // 1) Inline code: `code` -> reverse video
  text = text.replace(/`([^`]+?)`/g, `${COLOR_CODE}$1${COLOR_RESET}`);

  // 2) Bold: **bold**
  text = text.replace(
    /\*\*([^*]+?)\*\*/g,
    `${COLOR_BOLD}$1${COLOR_RESET}`
  );

  // 3) Underline: __underline__
  text = text.replace(
    /__([^_]+?)__/g,
    `${COLOR_UNDER}$1${COLOR_RESET}`
  );

  // 4) Italic single-star fallback -> DIM
  //    Use lookarounds so we don't match the stars used in bold (**)
  text = text.replace(
    /(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g,
    `${COLOR_DIM}$1${COLOR_RESET}`
  );

  // 5) Headings: # / ## / ###
  text = text.replace(
    /^###\s+(.*)$/gm,
    `${COLOR_BOLD}$1${COLOR_RESET}`
  );
  text = text.replace(
    /^##\s+(.*)$/gm,
    `${COLOR_BOLD}$1${COLOR_RESET}`
  );
  text = text.replace(
    /^#\s+(.*)$/gm,
    `${COLOR_BOLD}$1${COLOR_RESET}`
  );

  return text;
}

// =====================================
// Header
// =====================================

function showHeader(shortModels) {
  console.log(COLOR_HEADER + "=".repeat(60));
  console.log(` Model: ${ACTIVE_MODEL} | Available: ${shortModels}`);
  console.log("\n Recent Conversations:");

  const convs = listConversations();
  if (convs.length === 0) {
    console.log("   (none yet)");
  } else {
    for (const f of convs) {
      const num = path.basename(f).split(".")[0];
      let title;
      try {
        const raw = fs.readFileSync(f, "utf8");
        const obj = JSON.parse(raw);
        const msgs = obj.messages || [];
        title = msgs.length ? msgs[0].content.slice(0, 40) : "(empty)";
      } catch {
        title = "(unable to read)";
      }
      console.log(`   ${num}: ${title}`);
    }
  }

  console.log("=".repeat(60) + COLOR_RESET);
  console.log("\n\n");
}

// =====================================
// Scroll Output
// =====================================

async function printPaginated(rl, text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += PAGE_LINES) {
    const chunk = lines.slice(i, i + PAGE_LINES);
    console.log(chunk.join("\n"));
    if (i + PAGE_LINES < lines.length) {
      await ask(rl, COLOR_GPT + "--- Press ENTER to continue ---" + COLOR_RESET);
    }
  }
}

// =====================================
// API: Chat request
// =====================================

async function sendChatCompletion(messages) {
  const body = {
    model: ACTIVE_MODEL,
    messages,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const result = await resp.json();
  const reply = result.choices?.[0]?.message?.content ?? "";
  return reply.trim();
}

// =====================================
// Main loop
// =====================================

async function runConversation(shortModels) {
  const rl = createInterface();
  const messages = [];

  while (true) {
    showHeader(shortModels);
    console.log(COLOR_GPT + "(Type /help for commands)" + COLOR_RESET);

    const userInput = await ask(
      rl,
      `${COLOR_USER}You: ${COLOR_RESET}`
    );

    const lower = userInput.toLowerCase().trim();

    if (lower === "/exit" || lower === "/quit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (lower === "/help") {
      console.log(`
Commands:
  /new          Start a new empty conversation
  /save         Save the current conversation
  /load N       Load conversation number N
  /quit         Quit
`);
      await ask(rl, "Press ENTER to continue...");
      continue;
    }

    if (lower === "/new") {
      messages.length = 0;
      continue;
    }

    if (lower === "/save") {
      saveConversation(messages);
      console.log("Saved.");
      await ask(rl, "Press ENTER to continue...");
      continue;
    }

    if (lower.startsWith("/load ")) {
      const parts = lower.split(/\s+/);
      const n = parseInt(parts[1], 10);
      if (Number.isNaN(n)) {
        console.log("Invalid load command.");
      } else {
        const { messages: loaded, filename } = loadConversation(n);
        if (!loaded) {
          console.log("Conversation not found.");
        } else {
          messages.length = 0;
          messages.push(...loaded);
          console.log(`Loaded ${filename}.`);
        }
      }
      await ask(rl, "Press ENTER to continue...");
      continue;
    }

    // Add user message
    messages.push({ role: "user", content: userInput });

    // API request
    try {
      const re
