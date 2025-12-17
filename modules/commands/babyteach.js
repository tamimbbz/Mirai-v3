const axios = require("axios");

// rX Api Authur rX Abdullah
const GITHUB_API_URL = "https://raw.githubusercontent.com/rummmmna21/rx-api/main/baseApiUrl.json";

let mentionApiUrl = "";

// ===== Fetch mentionapi URL from GitHub =====
async function fetchMentionAPI() {
  try {
    const res = await axios.get(GITHUB_API_URL);
    mentionApiUrl = res.data?.mentionapi || "";
  } catch (err) {
    mentionApiUrl = "";
    console.error("❌ Could not fetch mentionapi URL:", err.message);
  }
}

module.exports.config = {
  name: "babyteach",
  version: "7.0.0",
  hasPermssion: 0,
  credits: "rX Abdullah",
  description: "Teach, reply & delete system via mentionapi API only (mention user + multiple replies + list commands)",
  commandCategory: "noprefix",
  usages: "!teach <trigger> - <reply>, !delteach <trigger>, !teach list, !teach msg <trigger>",
  cooldowns: 0
};

// ===== Reply system (normal triggers with mention + multiple replies support) =====
module.exports.handleEvent = async function ({ api, event, Users }) {
  if (!event.body) return;
  const text = event.body.trim();

  await fetchMentionAPI();
  if (!mentionApiUrl) return;

  try {
    const res = await axios.get(`${mentionApiUrl}/reply/${encodeURIComponent(text)}`);
    const replies = Array.isArray(res.data?.reply) ? res.data.reply : (res.data?.reply ? [res.data.reply] : []);
    if (replies.length > 0) {
      const name = await Users.getNameUser(event.senderID);
      const randomReply = replies[Math.floor(Math.random() * replies.length)];

      const message = `@${name} ${randomReply}`;
      const mentions = [{
        tag: `@${name}`,
        id: event.senderID,
        fromIndex: 0,
        length: name.length + 1
      }];

      return api.sendMessage({ body: message, mentions }, event.threadID, event.messageID);
    }
  } catch (_) { }
};

// ===== Teach / Delete / List commands via mentionapi API =====
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const content = args.join(" ").trim();

  await fetchMentionAPI();
  if (!mentionApiUrl) return api.sendMessage("❌ mentionapi not available", threadID, messageID);

  // ===== Teach =====
  if (event.body.startsWith("!teach ")) {
    const subCmd = args[0].toLowerCase();

    // ===== List all triggers =====
    if (subCmd === "list") {
      try {
        const res = await axios.get(`${mentionApiUrl}/list`);
        if (res.data?.triggers?.length) {
          const listMsg = res.data.triggers
            .map((t, i) => `${i + 1}. ${t.trigger} (${t.replies.length} replies)`)
            .join("\n");
          return api.sendMessage(listMsg, threadID, messageID);
        } else {
          return api.sendMessage("⚠ No triggers found.", threadID, messageID);
        }
      } catch (err) {
        return api.sendMessage(`❌ API error: ${err.message}`, threadID, messageID);
      }
    }

    // ===== Show all replies for a trigger =====
    if (subCmd === "msg" && args[1]) {
      const trigger = args.slice(1).join(" ").trim();
      try {
        const res = await axios.get(`${mentionApiUrl}/replies/${encodeURIComponent(trigger)}`);
        if (res.data?.replies?.length) {
          const msgList = res.data.replies.map((r, i) => `${i + 1}. ${r}`).join("\n");
          return api.sendMessage(`📝 Replies for "${trigger}":\n${msgList}`, threadID, messageID);
        } else {
          return api.sendMessage(`⚠ No replies found for "${trigger}"`, threadID, messageID);
        }
      } catch (err) {
        return api.sendMessage(`❌ API error: ${err.message}`, threadID, messageID);
      }
    }

    // ===== Normal teach: trigger - reply =====
    const parts = content.split(" - ");
    if (parts.length < 2) return api.sendMessage("❌ Format: !teach <trigger> - <reply>", threadID, messageID);

    const trigger = parts[0].trim();
    const reply = parts[1].trim();

    try {
      const res = await axios.post(`${mentionApiUrl}/teach`, { trigger, reply });
      const msg = res.data?.message || `✅ Trigger saved: "${trigger}"`;
      return api.sendMessage(msg, threadID, messageID);
    } catch (err) {
      return api.sendMessage(`❌ API error: ${err.response?.data?.message || err.message}`, threadID, messageID);
    }
  }

  // ===== Delete =====
  if (event.body.startsWith("!delteach ")) {
    const trigger = content.trim();
    try {
      const res = await axios.delete(`${mentionApiUrl}/delete/${encodeURIComponent(trigger)}`);
      const msg = res.data?.message || `🗑 Trigger deleted: "${trigger}"`;
      return api.sendMessage(msg, threadID, messageID);
    } catch (err) {
      return api.sendMessage(`❌ API error: ${err.response?.data?.message || err.message}`, threadID, messageID);
    }
  }
};
