export default async (request) => {
  const clientId = Netlify.env.get("TWITCH_CLIENT_ID");
  if (!clientId) return new Response("В Netlify сначала добавь TWITCH_CLIENT_ID.", { status: 503 });
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/.netlify/functions/twitch-callback`;
  const state = crypto.randomUUID();
  const authorize = new URL("https://id.twitch.tv/oauth2/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "moderator:read:followers",
    state
  }).toString();
  const headers = new Headers({ Location: authorize.toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `twitch_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/.netlify/functions/; Max-Age=600`);
  return new Response(null, { status: 302, headers });
};
