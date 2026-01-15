const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_BASE = "https://mirai-store.vercel.app";
const ADMINS = ["100087466441450"];

module.exports.config = {
 name: "miraistore",
 aliases: ["ms", "shop"],
 version: "2.4.0",
 hasPermission: 2,
 credits: "rX",
 description: "Mirai Command Store (Search, Like, Upload, Install, Delete, Trending, List)",
 commandCategory: "system",
 usages:
 "!ms <id | name | category>\n" +
 "!ms install <id>\n" +
 "!ms like <id>\n" +
 "!ms trending\n" +
 "!ms upload <commandName>\n" +
 "!ms delete <id> <secret>\n" +
 "!ms list [page]",
 cooldowns: 3
};

module.exports.run = async function({ api, event, args }) {
 const { threadID, senderID } = event;
 if (!args[0]) {
 return api.sendMessage(
 "📦 Mirai Store\n\nUsage:\n" +
 "• !ms <id | name | category>\n" +
 "• !ms install <id>\n" +
 "• !ms like <id>\n" +
 "• !ms trending\n" +
 "• !ms upload <commandName> (admin)\n" +
 "• !ms delete <id> <secret> (admin)\n" +
 "• !ms list [page]",
 threadID
 );
 }

 const sub = args[0].toLowerCase();

 // ================= UPLOAD =================
 if (sub === "upload") {
 if (!ADMINS.includes(senderID))
 return api.sendMessage("❌ You are not allowed to upload.", threadID);

 const cmdName = args[1];
 if (!cmdName) return api.sendMessage("📁 Please provide a command name.", threadID);

 const commandsPath = path.join(__dirname, "..", "commands");
 const filePath1 = path.join(commandsPath, cmdName);
 const filePath2 = path.join(commandsPath, cmdName + ".js");
 let fileToRead;

 if (fs.existsSync(filePath1)) fileToRead = filePath1;
 else if (fs.existsSync(filePath2)) fileToRead = filePath2;
 else return api.sendMessage("❌ File not found in `commands` folder.", threadID);

 try {
 const data = fs.readFileSync(fileToRead, "utf8");

 // Syntax check
 try { new Function(data); } catch (e) {
 return api.sendMessage(`❌ Syntax Error:\n${e.message}`, threadID);
 }

 const infoMsg = await new Promise((resolve, reject) => {
 api.sendMessage("📤 Uploading, please wait...", threadID, (err, info) => {
 if (err) reject(err); else resolve(info);
 });
 });

 const pasteRes = await axios.post("https://pastebin-api.vercel.app/paste", { text: data });
 setTimeout(() => api.unsendMessage(infoMsg.messageID), 1000);

 if (!pasteRes.data?.id)
 return api.sendMessage("⚠️ Upload failed. No valid ID received from PasteBin server.", threadID);

 const rawUrl = `https://pastebin-api.vercel.app/raw/${pasteRes.data.id}`;

 const res = await axios.post(`${API_BASE}/miraistore/upload`, { rawUrl });
 if (res.data?.error)
 return api.sendMessage(`⚠️ Paste uploaded but Miraistore API error: ${res.data.error}`, threadID);

 const name = data.match(/name\s*:\s*["'`](.*?)["'`]/)?.[1] || cmdName;
 const author = data.match(/credits\s*:\s*["'`](.*?)["'`]/)?.[1] || "Unknown";
 const version = data.match(/version\s*:\s*["'`](.*?)["'`]/)?.[1] || "N/A";
 const category = data.match(/commandCategory\s*:\s*["'`](.*?)["'`]/)?.[1] || "Unknown";
 const description = data.match(/description\s*:\s*["'`](.*?)["'`]/)?.[1] || "No description";
 const id = res.data.id;
 const uploadDate = new Date().toDateString();
 const views = 0;
 const likes = 0;

 const frameMsg =
`✅ Upload Successful!
╭─‣ Name : ${name}
├‣ Author : ${author}
├‣ Version : ${version}
├‣ Category : ${category}
├‣ ID : ${id}
╰────────────◊
⭔ Description: ${description}
⭔ Upload : ${uploadDate}
🌐 URL : ${rawUrl}`;

 return api.sendMessage(frameMsg, threadID);

 } catch (err) {
 console.error(err);
 return api.sendMessage("❌ Upload failed. Try again later.", threadID);
 }
 }

 // ================= DELETE =================
 if (sub === "delete") {
 if (!ADMINS.includes(senderID))
 return api.sendMessage("❌ You are not allowed to delete.", threadID);

 const id = args[1];
 const secret = args[2];
 if (!id || !secret)
 return api.sendMessage("❌ Usage: !miraistore delete <id> <secret>", threadID);

 try {
 const res = await axios.post(`${API_BASE}/miraistore/delete/${id}`, { secret });
 if (res.data?.error)
 return api.sendMessage(`❌ ${res.data.error}`, threadID);

 return api.sendMessage(`🗑️ Deleted!\n🆔 ID: ${id}`, threadID);
 } catch {
 return api.sendMessage("❌ Delete API error.", threadID);
 }
 }

 // ================= LIKE =================
 if (sub === "like") {
 const id = args[1];
 if (!id) return api.sendMessage("❌ Usage: !miraistore like <id>", threadID);

 try {
 const res = await axios.post(`${API_BASE}/miraistore/like/${id}`, { userID: senderID });
 if (res.data?.message) return api.sendMessage("⚠️ Already liked.", threadID);

 return api.sendMessage(`❤️ Liked!\nTotal Likes: ${res.data.likes}`, threadID);
 } catch {
 return api.sendMessage("❌ Like API error.", threadID);
 }
 }
// ================= INSTALL =================
if (sub === "install") {
 const id = args[1];
 if (!id)
 return api.sendMessage("❌ Usage: !miraistore install <id>", threadID);

 try {
 // fetch by id using search api
 const res = await axios.get(
 `${API_BASE}/miraistore/search?q=${encodeURIComponent(id)}`
 );

 const data = res.data;

 const cmd = Array.isArray(data)
 ? data.find(c => String(c.id) === String(id))
 : data;

 if (!cmd || !cmd.rawCode)
 return api.sendMessage("❌ rawCode not found for this ID.", threadID);

 const commandsPath = path.join(__dirname);
 const fileName =
 (cmd.name || `miraistore_${id}`).replace(/\s+/g, "_") + ".js";
 const filePath = path.join(commandsPath, fileName);

 if (fs.existsSync(filePath))
 return api.sendMessage("⚠️ Command already exists.", threadID);

 fs.writeFileSync(filePath, cmd.rawCode, "utf-8");

 // hot load
 delete require.cache[require.resolve(filePath)];
 const command = require(filePath);

 if (!command.config || !command.run)
 return api.sendMessage("❌ Invalid command structure.", threadID);

 global.client.commands.set(command.config.name, command);

 if (command.handleEvent)
 global.client.eventRegistered.push(command.config.name);

 return api.sendMessage(
 `✅ Installed & Loaded Successfully!\n\n📦 Name: ${command.config.name}\n🆔 ID: ${id}`,
 threadID
 );

 } catch (err) {
 console.error("INSTALL ERROR:", err);
 return api.sendMessage("❌ API fetch failed.", threadID);
 }
}
 // ================= TRENDING =================
 if (sub === "trend" || sub === "trending") {
 try {
 const res = await axios.get(`${API_BASE}/miraistore/trending?limit=3`);
 const data = res.data;

 if (!Array.isArray(data) || !data.length)
 return api.sendMessage("❌ No trending commands.", threadID);

 let msg = "🔥 Top 3 Trending Mirai Commands 🔥\n\n";
 data.forEach((cmd, i) => {
 const badge = i === 0 ? " 🏆 #1 TRENDING" : "";
 msg += `╭─‣ ${cmd.name}${badge}
├‣ Category : ${cmd.category}
├‣ Views : ${cmd.views}
├‣ Likes : ❤️ ${cmd.likes}
├‣ ID : ${cmd.id}
╰────────────◊

`;
 });

 return api.sendMessage(msg.trim(), threadID);
 } catch {
 return api.sendMessage("❌ Trending API error.", threadID);
 }
 }

 // ================= LIST =================
 if (sub === "list" || sub === "ls") {
 let page = Number(args[1]) || 1;
 if (page < 1) page = 1;
 const limit = 20;
 const offset = (page - 1) * limit;

 try {
 const res = await axios.get(`${API_BASE}/miraistore/list?limit=${limit}&offset=${offset}`);
 const data = res.data;

 if (!data || !Array.isArray(data.commands) || data.commands.length === 0)
 return api.sendMessage("❌ No commands found for this page.", threadID);

 let msg = `📂 Miraistore List — Page ${page} / ${Math.ceil(data.total / limit)}\n\n`;
 data.commands.forEach(cmd => {
 msg += `╭─‣ ${cmd.name}
├‣ Category : ${cmd.category}
├‣ ID : ${cmd.id}
├‣ Upload : ${new Date(cmd.uploadDate).toDateString()}
╰────────────◊

`;
 });

 return api.sendMessage(msg.trim(), threadID);
 } catch (err) {
 console.error(err);
 return api.sendMessage("❌ List API error.", threadID);
 }
 }

 // ================= SEARCH =================
 const query = args.join(" ");
 try {
 const res = await axios.get(`${API_BASE}/miraistore/search?q=${encodeURIComponent(query)}`);
 const data = res.data;

 if (!data || data.message) return api.sendMessage("❌ Command not found.", threadID);

 if (Array.isArray(data)) {
 let msg = `📂 Search Results (${data.length})\n\n`;
 data.forEach(cmd => {
 msg += `╭─‣ ${cmd.name}
├‣ Category : ${cmd.category}
├‣ ID : ${cmd.id}
├‣ Upload : ${new Date(cmd.uploadDate).toDateString()}
╰────────────◊

`;
 });
 return api.sendMessage(msg.trim(), threadID);
 }

 const message = `╭─‣ Name : ${data.name}
├‣ Author : ${data.author}
├‣ Version : ${data.version || "N/A"}
├‣ Category : ${data.category}
├‣ Views : ${data.views}
├‣ Likes : ❤️ ${data.likes}
├‣ ID : ${data.id}
╰────────────◊
⭔ Description: ${data.description || "No description"}
⭔ Upload : ${new Date(data.uploadDate).toDateString()}
🌐 URL : ${data.rawUrl}`;

 return api.sendMessage(message, threadID);
 } catch {
 return api.sendMessage("❌ Search API error.", threadID);
 }
};
