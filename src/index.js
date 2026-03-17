const express = require("express");
const path = require("path");
const fs = require("fs");
const redis = require("./redis");

const app = express();
const PORT = 3000;

app.use(express.json());

// serve static
app.use(express.static(path.join(__dirname, "../www")));

// read student id
let studentId = "unknown";
try {
  studentId = fs.readFileSync(
    path.join(__dirname, "../student_id.txt"),
    "utf8"
  ).trim();
} catch {
  console.log("student_id.txt not found");
}

// build time
const buildTime = process.env.BUILD_TIME || "local-build";

// หน้า root
app.get("/", async (req, res) => {
  let redisStatus = "disconnected";

  try {
    await redis.set("test", "ok");
    redisStatus = "connected";
  } catch (err) {
    redisStatus = "error";
  }

  res.send(`
    <h1>URL Shortener</h1>
    <p><b>Student ID:</b> ${studentId}</p>
    <p><b>Build Time:</b> ${buildTime}</p>
    <p><b>Redis Status:</b> ${redisStatus}</p>
  `);
});

// shorten
app.post("/shorten", async (req, res) => {
  const { url, code } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const shortCode = code || Math.random().toString(36).substring(2, 8);

  await redis.set(shortCode, url);

  res.json({
    short_url: `${req.protocol}://${req.get("host")}/${shortCode}`
  });
});

// redirect
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  const url = await redis.get(code);

  if (!url) {
    return res.status(404).send("Not found");
  }

  res.redirect(url);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});