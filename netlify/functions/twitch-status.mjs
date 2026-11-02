import { getStore } from "@netlify/blobs";

export default async () => {
  const clientId = Netlify.env.get("TWITCH_CLIENT_ID");
  const clientSecret = Netlify.env.get("TWITCH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return Response.json({ connected: false, error: "Missing Twitch app credentials" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const store = getStore("djaben-twitch-auth");
    const saved = await store.get("credentials", { type: "json" });
    if (!saved?.refresh_token || !saved?.broadcaster_id) return Response.json({ connected: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    let accessToken = saved.access_token;
    if (!saved.expires_at || Date.now() > saved.expires_at - 60000) {
      const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: saved.refresh_token })
      });
      if (!tokenResponse.ok) return Response.json({ connected: false, error: "Twitch reauthorization required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      const token = await tokenResponse.json();
      accessToken = token.access_token;
      await store.setJSON("credentials", { ...saved, access_token: token.access_token, refresh_token: token.refresh_token || saved.refresh_token, expires_at: Date.now() + token.expires_in * 1000 });
    }
    const headers = { "Client-Id": clientId, "Authorization": `Bearer ${accessToken}` };
    const [streamRes, followerRes] = await Promise.all([
      fetch("https://api.twitch.tv/helix/streams?user_login=djaben_sq", { headers }),
      fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(saved.broadcaster_id)}&first=1`, { headers })
    ]);
    if (!streamRes.ok || !followerRes.ok) throw new Error("Twitch API request failed");
    const [streamData, followerData] = await Promise.all([streamRes.json(), followerRes.json()]);
    const stream = streamData.data?.[0];
    return Response.json({ connected: true, online: Boolean(stream), title: stream?.title || null, game: stream?.game_name || null, followers: Number.isFinite(followerData.total) ? followerData.total : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ connected: false, error: "Unable to fetch Twitch data" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};
