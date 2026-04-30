const functions = require("firebase-functions");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

const APP_ID = "98299e33a32f4137a94daacc5422c92e";
const APP_CERTIFICATE = "ea7ad2e0c0bc4a98a35f3617931fa7ac";

exports.getAgoraToken = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const channelName = req.body.channelName || req.query.channelName;

  if (!channelName) {
    res.status(400).json({ error: "channelName required" });
    return;
  }

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    0,
    role,
    privilegeExpireTime
  );

  res.status(200).json({ token });
});