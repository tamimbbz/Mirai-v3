const fs = require("fs");
const path = require("path");

// 🔹 JSON location
const protectFile = path.join(__dirname, "rx", "protect.json");

// 🔒 Load JSON
function loadProtect() {
  if (!fs.existsSync(protectFile)) return {};
  return JSON.parse(fs.readFileSync(protectFile, "utf-8"));
}

// 💾 Save JSON
function saveProtect(data) {
  fs.writeFileSync(protectFile, JSON.stringify(data, null, 2), "utf-8");
}

// ⚙️ Config
module.exports.config = {
  name: "protect",
  eventType: ["log:thread-name", "log:thread-icon", "log:thread-image"],
  version: "2.5.0",
  credits: "rX | 𝗺𝗼𝗱𝗶𝗳𝘆 𝗧𝗮𝗺𝗶𝗺 𝗯𝗯𝘇",
  description: "Manual + Auto-save group protection (𝗦𝗨𝗥𝗢𝗩𝗜 × 𝗯𝗯𝘇 𝗰𝗵𝗮𝘁𝗯𝗼𝘅)"
};

// 🚀 Run on bot start → auto-save all groups
module.exports.run = async function({ api }) {
  try {
    const allThreads = await api.getThreadList(100, null, ["INBOX"]); // fetch top 100 threads
    const protect = loadProtect();

    for (let thread of allThreads) {
      if (!protect[thread.threadID]) {
        protect[thread.threadID] = {
          name: thread.name || null,
          emoji: thread.emoji || null
        };
      }
    }

    saveProtect(protect);
    console.log("🛡️ Protect system active & groups auto-saved.");
  } catch (err) {
    console.error("❌ Auto-save error:", err);
  }
};

// ⚡ Event handler
module.exports.runEvent = async function({ event, api }) {
  try {
    const protect = loadProtect();
    const threadID = event.threadID;

    if (!protect[threadID]) return; // ignore if thread not in JSON

    const info = protect[threadID];
    const threadInfo = await api.getThreadInfo(threadID);
    const isAdmin = threadInfo.adminIDs.some(adm => adm.id == event.author);

    if (isAdmin) return; // admin allowed

    // ❌ Non-admin → restore if custom value exists
    if (event.logMessageType === "log:thread-name" && info.name) {
      await api.setTitle(info.name, threadID);
      await api.sendMessage(`⚠️ Non-admin [${event.author}] tried to change group name\nRestored: ${info.name}`, threadID);
    } 
    else if (event.logMessageType === "log:thread-icon" && info.emoji) {
      await api.changeThreadEmoji(info.emoji, threadID);
      await api.sendMessage("⚠️ ইমোজি পরিবর্তন অনুমোদিত নয়!\n🩷 𝗧𝗵𝗶𝘀 𝗴𝗿𝗼𝘂𝗽 𝗶𝘀𝗽𝗿𝗼𝘁𝗲𝗰𝘁𝗲𝗱", threadID);
    } 
    else if (event.logMessageType === "log:thread-image") {
      const pathImg = path.join(__dirname, "rx", "cache", threadID + ".png");
      if (fs.existsSync(pathImg)) {
        await api.changeGroupImage(fs.createReadStream(pathImg), threadID);
      }
      await api.sendMessage("⚠️ গ্রুপ ছবির পরিবর্তন অনুমোদিত নয়!\n🩷 𝗧𝗵𝗶𝘀 𝗴𝗿𝗼𝘂𝗽 𝗶𝘀𝗽𝗿𝗼𝘁𝗲𝗰𝘁𝗲𝗱 𝗯𝘆 𝗯𝗯𝘇 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁", threadID);
    }

  } catch (err) {
    console.error("[Protect Event Error]", err);
  }
};
