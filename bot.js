require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌  TELEGRAM_BOT_TOKEN is missing. Copy .env.example → .env and add your token.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const DICT_API = "https://api.dictionaryapi.dev/api/v2/entries/en";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape characters that break MarkdownV2 */
function esc(text = "") {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/** Fetch word data from Free Dictionary API */
async function fetchWord(word) {
  const { data } = await axios.get(`${DICT_API}/${encodeURIComponent(word)}`);
  return data; // array of entries
}

/** Build a nicely formatted MarkdownV2 message from API data */
function buildDefinitionMessage(entries, word) {
  const lines = [];

  lines.push(`📖 *${esc(word.toUpperCase())}*`);

  // Phonetic
  const phonetic = entries
    .flatMap((e) => e.phonetics || [])
    .find((p) => p.text);
  if (phonetic?.text) lines.push(`_${esc(phonetic.text)}_`);

  lines.push("");

  let defCount = 0;

  for (const entry of entries) {
    for (const meaning of entry.meanings || []) {
      lines.push(`*${esc(meaning.partOfSpeech)}*`);

      const defs = meaning.definitions.slice(0, 3); // max 3 defs per POS
      for (const def of defs) {
        defCount++;
        lines.push(`  ${esc(defCount + ".")} ${esc(def.definition)}`);

        if (def.example) {
          lines.push(`      _"${esc(def.example)}"_`);
        }
      }

      // Synonyms
      const syns = (meaning.synonyms || []).slice(0, 5);
      if (syns.length) {
        lines.push(`  🔗 *Synonyms:* ${syns.map(esc).join(", ")}`);
      }

      // Antonyms
      const ants = (meaning.antonyms || []).slice(0, 5);
      if (ants.length) {
        lines.push(`  ↔️ *Antonyms:* ${ants.map(esc).join(", ")}`);
      }

      lines.push("");
    }
  }

  // Source
  const source = entries[0]?.sourceUrls?.[0];
  if (source) {
    lines.push(`🌐 [More on Wiktionary](${source})`);
  }

  return lines.join("\n");
}

/** Quick inline keyboard for follow-up actions */
function actionKeyboard(word) {
  return {
    inline_keyboard: [
      [
        { text: "🔊 Pronunciation", callback_data: `audio:${word}` },
        { text: "📚 More examples", callback_data: `examples:${word}` },
      ],
      [{ text: "🔁 Look up another word", callback_data: "another" }],
    ],
  };
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || "there";
  bot.sendMessage(
    msg.chat.id,
    `👋 Hey *${esc(name)}*\\! I'm your pocket dictionary\\.\n\n` +
      `Just send me any English word and I'll give you:\n` +
      `• 📖 Definitions\n` +
      `• 💬 Example sentences\n` +
      `• 🔗 Synonyms & antonyms\n` +
      `• 🔊 Pronunciation\n\n` +
      `Try it — send me a word like *serendipity* or *ephemeral* ✨`,
    { parse_mode: "MarkdownV2" }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `*How to use me*\n\n` +
      `• Type any English word → get its definition\n` +
      `• /define <word> → explicit lookup\n` +
      `• /random → discover a random word\n` +
      `• /help → show this message\n\n` +
      `_Powered by the Free Dictionary API_`,
    { parse_mode: "MarkdownV2" }
  );
});

bot.onText(/\/define (.+)/, async (msg, match) => {
  const word = match[1].trim();
  await lookupWord(msg.chat.id, word, msg.message_id);
});

bot.onText(/\/random/, async (msg) => {
  // A small curated list of interesting words for random lookup
  const words = [
    "serendipity", "ephemeral", "melancholy", "ubiquitous", "labyrinth",
    "eloquent", "resilience", "nostalgia", "benevolent", "zenith",
    "solace", "reverie", "quixotic", "luminous", "petrichor",
  ];
  const word = words[Math.floor(Math.random() * words.length)];
  await lookupWord(msg.chat.id, word, msg.message_id);
});

// ─── Core Lookup ──────────────────────────────────────────────────────────────

async function lookupWord(chatId, word, replyToMessageId) {
  if (!word || word.length < 1) return;

  // Send "typing…" indicator
  bot.sendChatAction(chatId, "typing");

  try {
    const entries = await fetchWord(word);
    const text = buildDefinitionMessage(entries, word);

    await bot.sendMessage(chatId, text, {
      parse_mode: "MarkdownV2",
      reply_to_message_id: replyToMessageId,
      reply_markup: actionKeyboard(word),
      disable_web_page_preview: true,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      await bot.sendMessage(
        chatId,
        `😕 I couldn't find *${esc(word)}*\\.\n\n` +
          `Double\\-check the spelling, or try a different form of the word\\.`,
        { parse_mode: "MarkdownV2", reply_to_message_id: replyToMessageId }
      );
    } else {
      console.error("API error:", err.message);
      await bot.sendMessage(
        chatId,
        "⚠️ Something went wrong\\. Please try again in a moment\\.",
        { parse_mode: "MarkdownV2", reply_to_message_id: replyToMessageId }
      );
    }
  }
}

// ─── Plain text messages → treat as word lookup ───────────────────────────────

bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    const word = msg.text.trim().split(/\s+/)[0]; // use first word only
    lookupWord(msg.chat.id, word, msg.message_id);
  }
});

// ─── Callback queries (inline buttons) ────────────────────────────────────────

bot.on("callback_query", async (query) => {
  const { data, message } = query;
  const chatId = message.chat.id;

  await bot.answerCallbackQuery(query.id);

  if (data === "another") {
    await bot.sendMessage(chatId, "Sure\\! Send me the next word 🔤", {
      parse_mode: "MarkdownV2",
    });
    return;
  }

  const [action, ...rest] = data.split(":");
  const word = rest.join(":");

  if (action === "audio") {
    try {
      const entries = await fetchWord(word);
      const audioUrl = entries
        .flatMap((e) => e.phonetics || [])
        .find((p) => p.audio && p.audio.startsWith("http"))?.audio;

      if (audioUrl) {
        await bot.sendAudio(chatId, audioUrl, {
          caption: `🔊 Pronunciation of *${esc(word)}*`,
          parse_mode: "MarkdownV2",
        });
      } else {
        await bot.sendMessage(
          chatId,
          `😔 No audio available for *${esc(word)}*\\.`,
          { parse_mode: "MarkdownV2" }
        );
      }
    } catch {
      await bot.sendMessage(chatId, "⚠️ Could not fetch audio\\.", {
        parse_mode: "MarkdownV2",
      });
    }
  }

  if (action === "examples") {
    try {
      const entries = await fetchWord(word);
      const examples = entries
        .flatMap((e) => e.meanings || [])
        .flatMap((m) => m.definitions || [])
        .map((d) => d.example)
        .filter(Boolean)
        .slice(0, 8);

      if (examples.length) {
        const lines = [`📚 *Examples for ${esc(word)}*\n`];
        examples.forEach((ex, i) => {
          lines.push(`${i + 1}\\. _${esc(ex)}_`);
        });
        await bot.sendMessage(chatId, lines.join("\n"), {
          parse_mode: "MarkdownV2",
        });
      } else {
        await bot.sendMessage(
          chatId,
          `😔 No extra examples found for *${esc(word)}*\\.`,
          { parse_mode: "MarkdownV2" }
        );
      }
    } catch {
      await bot.sendMessage(chatId, "⚠️ Could not fetch examples\\.", {
        parse_mode: "MarkdownV2",
      });
    }
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

console.log("📚 Dictionary bot is running…");
bot.on("polling_error", (err) => console.error("Polling error:", err.message));
