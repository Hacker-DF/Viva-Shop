// Fonction send-push : envoie une notification Web Push à tous les téléphones d'un client.
// Déclenchée par un Database Webhook sur INSERT dans la table notifications.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@vivashop.example',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  const body = await req.json();
  const record = body.record ?? body;
  if (!record?.user_id) return new Response('ignored', { status: 200 });

  const { data: subs } = await admin.from('push_subscriptions')
    .select('endpoint, p256dh, auth').eq('user_id', record.user_id);
  const payload = JSON.stringify({ title: record.title, body: record.body, link: record.link });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (err) {
      // Abonnement expiré ou supprimé côté navigateur : on le retire
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
