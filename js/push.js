/**
 * push.js — Activation des notifications sur ce téléphone (Web Push).
 * L'abonnement est enregistré dans push_subscriptions ; l'envoi est fait par la fonction send-push.
 */
import { APP_CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { t } from './i18n.js';

const keyBytes = (b64) => {
  const base64 = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function isSubscribed() {
  const reg = await navigator.serviceWorker.ready;
  return Boolean(await reg.pushManager.getSubscription());
}

export async function enablePush() {
  if (!pushSupported()) throw new Error(t('push.unsupported'));
  const key = APP_CONFIG.push?.vapidPublicKey || '';
  if (!key || key.startsWith('REMPLACER')) throw new Error(t('push.unconfigured'));
  const session = await getSession();
  if (!session) throw new Error(t('push.login'));
  if ((await Notification.requestPermission()) !== 'granted') throw new Error(t('push.denied'));

  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
