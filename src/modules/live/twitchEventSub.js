const crypto = require("crypto");

/**
 * Verifica assinatura EventSub (HMAC-SHA256)
 * message = id + timestamp + raw_body
 * assinatura vem em: Twitch-Eventsub-Message-Signature: sha256=...
 */
function verifyTwitchSignature(req, rawBody) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  const msgId = req.header("Twitch-Eventsub-Message-Id");
  const timestamp = req.header("Twitch-Eventsub-Message-Timestamp");
  const signature = req.header("Twitch-Eventsub-Message-Signature");

  if (!secret || !msgId || !timestamp || !signature) return false;

  const hmacMessage = msgId + timestamp + rawBody;
  const computed =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(hmacMessage).digest("hex");

  // comparação segura
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Registra o endpoint no app Express.
 * sendLiveAlert: função que vai postar no Discord quando ficar online.
 */
function registerTwitchEventSub(app, sendLiveAlert) {
  // Precisamos do raw body para validar assinatura.
  app.post(
    "/twitch/eventsub",
    // middleware para capturar o rawBody
    require("express").raw({ type: "application/json" }),
    async (req, res) => {
      const rawBody = req.body.toString("utf8");

      const msgType = req.header("Twitch-Eventsub-Message-Type");
      const msgId = req.header("Twitch-Eventsub-Message-Id");

      // 1) challenge de verificação
      if (msgType === "webhook_callback_verification") {
        try {
          const payload = JSON.parse(rawBody);
          return res.status(200).send(payload.challenge);
        } catch {
          return res.sendStatus(400);
        }
      }

      // 2) valida assinatura para notification/revocation
      const ok = verifyTwitchSignature(req, rawBody);
      if (!ok) {
        console.warn("[EventSub] assinatura inválida", { msgId });
        return res.sendStatus(403);
      }

      // 3) evento real
      if (msgType === "notification") {
        const payload = JSON.parse(rawBody);

        const subType = payload?.subscription?.type; // "stream.online"
        const event = payload?.event;

        if (subType === "stream.online") {
          // Aqui você pode colocar anti-spam depois
          await sendLiveAlert({
            broadcaster_user_id: event?.broadcaster_user_id,
            broadcaster_user_name: event?.broadcaster_user_name,
            started_at: event?.started_at,
          });
        }

        return res.sendStatus(200);
      }

      // 4) revocation
      if (msgType === "revocation") {
        console.warn("[EventSub] subscription revogada", rawBody);
        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    }
  );
}

module.exports = { registerTwitchEventSub };
