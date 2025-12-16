const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "babyimg",
  version: "1.0.2",
  hasPermssion: 0,
  credits: "rX", //don't change this credit
  description: "Send image as reply to trigger word",
  commandCategory: "auto",
  usages: "",
  cooldowns: 0,
  prefix: false
};

const imageTriggers = [
  {
    keywords: ["khabo", "khuda lagse"],
    imageUrl: "https://i.postimg.cc/x8p156pR/8c3b955e8309b478efc1073e09f72075.jpg",
    reply: "🍽️ 😋",
    fileName: "khabo.jpg"
  },
  {
    keywords: ["holpagol", "sex"],
    imageUrl: "https://i.postimg.cc/Vs26JVMf/e052f3e1f21ab2d1c07312c720eda6ae.jpg",
    reply: "🌙 boka nki 😴",
    fileName: "gumkorefela.jpg"
  },
  {
    keywords: ["handel mara"],
    imageUrl: "https://i.postimg.cc/QxBZYxj7/IMG-7310.jpg",
    reply: "Ai ne",
    fileName: "handel.jpg"
  },
  {
    keywords: ["maria pik", "maria pik daw"],
    imageUrl: "https://i.postimg.cc/qMwr5nh6/IMG-6381.jpg",
    reply: "🎀🧃",
    fileName: "maria.jpg"
  },
  {
    keywords: ["bara", "bokaxhuda", "hol pagol"],
    imageUrl: "https://i.postimg.cc/j5N1pWc7/81e81232266d1c0220e6f4cbf7214bea.jpg",
    reply: "",
    fileName: "bokaxhuda.jpg"
  },
  {
    keywords: ["pixlist dew"],
    imageUrl: "https://i.postimg.cc/6q7ZkN04/IMG-7186.png",
    reply: "📜 Pixlist bY rX",
    fileName: "pixlist.png"
  }
];

module.exports.handleEvent = async function({ api, event }) {
  const msg = event.body?.toLowerCase();
  if (!msg) return;

  for (const trigger of imageTriggers) {
    if (trigger.keywords.some(k => msg.includes(k))) {
      const filePath = path.join(__dirname, trigger.fileName);
      try {
        const res = await axios.get(trigger.imageUrl, { responseType: "arraybuffer" });
        fs.writeFileSync(filePath, Buffer.from(res.data, "binary"));

        api.sendMessage({
          body: trigger.reply,
          attachment: fs.createReadStream(filePath)
        }, event.threadID, () => fs.unlinkSync(filePath), event.messageID); // ✅ reply to user
      } catch (err) {
        console.log(`❌ Failed to send image for ${trigger.keywords[0]}:`, err.message);
      }
      return;
    }
  }
};

module.exports.run = () => {};
