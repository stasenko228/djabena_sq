import { getStore } from "@netlify/blobs";

export default async (request) => {
  const url = new URL(request.url);
  const clientId = Netlify.env.get("TWITCH_CLIENT_ID");
  const clientSecret = Netlify.env.get("TWITCH_CLIENT_SECRET");
  const expectedState = request.headers.get("cookie")?.match(/(?:^|;\s*)twitch_oauth_state=([^;]+)/)?.[1];
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const page = (message) => new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0;background:#10091c;color:white;font:18px system-ui;padding:32px"><h2>djaben_sq · Twitch</h2><p>${message}</p><p>Можно закрыть это окно и вернуться на сайт.</p><a style="color:#d8a5ff" href="/">Вернуться на сайт</a></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (error) return page("Ты отменил подключение Twitch. Ничего не изменено.");
  if (!clientId || !clientSecret) return page("В Netlify не заданы Client ID и Client Secret.");
  if (!code || !state || !expectedState || state !== expectedState) return page("Проверка безопасности не прошла. Вернись на сайт и попробуй подключить Twitch ещё раз.");
  const redirectUri = `${url.origin}/.netlify/functions/twitch-callback`;
  try {
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri })
    });
    if (!tokenResponse.ok) return page("Twitch не выдал токен. Проверь Client ID, Secret и OAuth Redirect URL в Twitch Developer Console.");
    const token = await tokenResponse.json();
    const headers = { "Client-Id": clientId, "Authorization": `Bearer ${token.access_token}` };
    const userResponse = await fetch("https://api.twitch.tv/helix/users", { headers });
    if (!userResponse.ok) return page("Не удалось определить Twitch-аккаунт.");
    const userData = await userResponse.json();
    const user = userData.data?.[0];
    if (!user) return page("Twitch не вернул данные аккаунта.");
    const store = getStore("djaben-twitch-auth");
    await store.setJSON("credentials", { access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + token.expires_in * 1000, broadcaster_id: user.id, login: user.login });
    return page(`Готово! Twitch-аккаунт @${user.login} подключён. Статистика и статус эфира теперь будут обновляться автоматически.`);
  } catch (e) {
    return page("Во время подключения произошла ошибка. Попробуй ещё раз.");
  }
};
