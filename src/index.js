const express = require("express");
const path = require("path");
const fs = require("fs");
const redis = require("./redis");

const app = express();
const PORT = 3000;

// middleware
app.use(express.json());

// serve static files from www
app.use(express.static(path.join(__dirname, "../www")));

// read student id
let studentId = "unknown";
try {
  studentId = fs
    .readFileSync(path.join(__dirname, "../student_id.txt"), "utf8")
    .trim();
} catch (err) {
  console.log("student_id.txt not found");
}

// build time from docker / CI
const buildTime = process.env.BUILD_TIME || "local-build";

// API: show info
app.get("/info", (req, res) => {
  res.json({
    student_id: studentId,
    build_time: buildTime
  });
});

// shorten url
app.post("/shorten", async (req, res) => {
  const { url, code } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const shortCode = code || Math.random().toString(36).substring(2, 8);

  try {
    await redis.set(shortCode, url);
    res.json({
      short_code: shortCode,
      short_url: `${req.protocol}://${req.get("host")}/${shortCode}`
    });
  } catch (err) {
    res.status(500).json({ error: "Redis error" });
  }
});

// redirect short url
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  try {
    const url = await redis.get(code);

    if (!url) {
      return res.status(404).send("Not found");
    }

    res.redirect(url);
  } catch (err) {
    res.status(500).send("Redis error");
  }
});

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});