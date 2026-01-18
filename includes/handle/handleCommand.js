const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");
const moment = require("moment-timezone");
const logger = require("../../utils/log.js");
const axios = require("axios");

// =======================
// Helper: Full name mention detection
// =======================
async function getUIDByFullName(api, threadID, body) {
  if (!body.includes("@")) return null;

  const match = body.match(/@(.+)/);
  if (!match) return null;

  const targetName = match[1].trim().toLowerCase().replace(/\s+/g, " ");

  const threadInfo = await api.getThreadInfo(threadID);
  const users = threadInfo.userInfo || [];

  const user = users.find(u => {
    if (!u.name) return false;
    const fullName = u.name.trim().toLowerCase().replace(/\s+/g, " ");
    return fullName === targetName;
  });

  return user ? user.id : null;
}

// =======================
// Main handler
// =======================
module.exports = function ({ api, models, Users, Threads, Currencies }) {
  // ===== VIP helpers =====
  const vipFilePath = path.join(__dirname, "../../modules/commands/rx/vip.json");
  const vipModePath = path.join(__dirname, "../../modules/commands/rx/vipMode.json");

  const loadVIP = () => {
    if (!fs.existsSync(vipFilePath)) return [];
    const data = fs.readFileSync(vipFilePath, "utf-8");
    return JSON.parse(data);
  };

  const loadVIPMode = () => {
    if (!fs.existsSync(vipModePath)) return false;
    const data = fs.readFileSync(vipModePath, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.vipMode || false;
  };
  // ===== End VIP helpers =====

  return async function ({ event }) {
    const dateNow = Date.now();
    const time = moment.tz("Asia/Dhaka").format("HH:MM:ss DD/MM/YYYY");
    const { allowInbox, PREFIX, ADMINBOT, NDH, DeveloperMode } = global.config;
    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands, cooldowns } = global.client;

    let { body, senderID, threadID, messageID, mentions, type, messageReply } = event;
    senderID = String(senderID);
    threadID = String(threadID);
    body = body || "x";

    const threadSetting = threadData.get(threadID) || {};
    const threadPrefix = threadSetting.PREFIX || PREFIX;
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(threadPrefix)})\\s*`);

    let args = [];
    let commandName = "";
    const prefixUsed = body.startsWith(threadPrefix);

    // Load VIP data
    const vipList = loadVIP();
    const vipMode = loadVIPMode();
    const isVIP = vipList.includes(senderID);

    // ADMIN or VIP → can use without prefix
    if ((ADMINBOT.includes(senderID) || isVIP) && !prefixUsed) {
      const temp = body.trim().split(/ +/);
      commandName = temp.shift()?.toLowerCase();
      args = temp;
    } else {
      if (!prefixRegex.test(body)) return;
      const [matchedPrefix] = body.match(prefixRegex);
      const argsTemp = body.slice(matchedPrefix.length).trim().split(/ +/);
      commandName = argsTemp.shift()?.toLowerCase();
      args = argsTemp;
    }

    if (!commandName) return api.sendMessage(global.getText("handleCommand", "onlyprefix"), threadID, messageID);

    // Resolve aliases
    for (const [cmdName, cmdObj] of commands) {
      if (cmdObj.config.aliases && cmdObj.config.aliases.includes(commandName)) {
        commandName = cmdName;
        break;
      }
    }

    let command = commands.get(commandName);
    if (!command && prefixUsed) {
      const allCommandName = Array.from(commands.keys());
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) command = commands.get(checker.bestMatch.target);
      else return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
    }
    if (!command && !prefixUsed) return;
    if (!command) {
      const allCommandName = Array.from(commands.keys());
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) command = commands.get(checker.bestMatch.target);
      else return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
    }

    // ===== Banned check =====
    if (userBanned.has(senderID) || threadBanned.has(threadID)) {
      if (!ADMINBOT.includes(senderID)) {
        const banData = userBanned.has(senderID) ? userBanned.get(senderID) : threadBanned.get(threadID);
        return api.sendMessage(
          global.getText(
            userBanned.has(senderID) ? "handleCommand.userBanned" : "handleCommand.threadBanned",
            banData.reason,
            banData.dateAdded
          ),
          threadID,
          async (err, info) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
