const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pushText, pushLang, slotTimeLabel, SUPPORTED_PUSH_LANGS } = require("./pushText");

// Every key of the az set, read from the source (STRINGS is not exported).
const src = fs.readFileSync(path.join(__dirname, "pushText.js"), "utf8");
const strings = src.slice(src.indexOf("const STRINGS"));
const azBlock = strings.slice(0, strings.indexOf("  tr: {"));
const KEYS = [...azBlock.matchAll(/^ {4}([a-z0-9_]+): /gm)].map((m) => m[1]);

test("every language has every push key, with no empty copy", () => {
  assert.ok(KEYS.length > 50);
  for (const lang of SUPPORTED_PUSH_LANGS) {
    for (const key of KEYS) {
      const warn = console.warn;
      let warned = false;
      console.warn = () => { warned = true; };
      const { title, body } = pushText(lang, key, {
        time: "14:00", count: 2, streak: 3, flags: 1, callerName: "Saya", topic: "Travel", usd: 5,
        nameA: "A", nameB: "B", pairs: 1, unmet: 0, offers: 1, people: 2,
      });
      console.warn = warn;
      assert.ok(!warned && title && !`${title} ${body}`.includes("undefined"), `${lang}.${key}`);
    }
  }
});

test("Russian is a push language, with its own day words", () => {
  assert.ok(SUPPORTED_PUSH_LANGS.includes("ru"));
  assert.equal(pushLang({ appLanguage: "ru" }), "ru");
  const t = Date.UTC(2026, 10, 12, 10, 0);
  assert.equal(slotTimeLabel(t, "ru", "Asia/Baku", t - 3600000), "Сегодня 14:00");
  const r = pushText("ru", "call_reminder_1h", { time: "Сегодня 14:00", peerName: "Saya" });
  assert.equal(r.title, "Практика через час — Сегодня 14:00");
  assert.match(r.body, /^Saya /);
});
