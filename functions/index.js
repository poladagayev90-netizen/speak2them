const functions = require("firebase-functions");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

const APP_ID = "98299e33a32f4137a94daacc5422c92e";
const APP_CERTIFICATE = "ea7ad2e0c0bc4a98a35f3617931fa7ac";

exports.getAgoraToken = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const channelName = data.channelName;
  const uid = context.auth.uid;
  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );

  return { token };
});