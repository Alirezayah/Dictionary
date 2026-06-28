# 📚 Telegram Dictionary Bot

A Telegram bot that lets users look up English words and get definitions, examples, synonyms, antonyms, and pronunciation — all without leaving Telegram.

## Features

- 📖 **Definitions** — multiple meanings grouped by part of speech
- 💬 **Example sentences** — real usage examples
- 🔗 **Synonyms & antonyms** — related words at a glance
- 🔊 **Pronunciation audio** — listen to how a word sounds
- 🎲 **Random word** — discover an interesting word at random
- Inline buttons for quick follow-up actions

## Setup

### 1. Create your bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **API token** BotFather gives you

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and paste your token:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
```

### 3. Install dependencies & run

```bash
npm install
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show available commands |
| `/define <word>` | Look up a specific word |
| `/random` | Get a random interesting word |
| _(any text)_ | Automatically looks up the first word |

## API

Uses the free [Free Dictionary API](https://dictionaryapi.dev/) — no key required.

## Project Structure

```
telegram-dictionary-bot/
├── bot.js          # Main bot logic
├── package.json
├── .env.example    # Environment variable template
├── .gitignore
└── README.md
```
