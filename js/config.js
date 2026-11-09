/**
 * config.js — Configuration centrale de Viva Shop
 *
 * ⚠️ Ne mettre ici QUE la clé "anon" (publique) de Supabase.
 * La clé "service_role" ne doit JAMAIS apparaître dans le frontend.
 */
export const APP_CONFIG = {
  name: 'Viva Shop', // Nom officiel : à confirmer, un seul endroit à modifier
  slogan: 'Votre passerelle entre la Chine et le Togo',
  defaultLang: 'fr',

  // À remplacer par les valeurs de votre projet Supabase (Settings → API)
  supabaseUrl: 'https://envpqhsdekwbgwqvisdt.supabase.co',
  supabaseAnonKey: 'sb_publishable_6huk6TSoyJKaAgUd2o_d0w_3YtvDARy',

  // Communauté et chaîne WhatsApp officielles
  whatsapp: {
    communityUrl: 'https://chat.whatsapp.com/CgluhvprL7zHhJlaqorVja',
    channelUrl: 'https://whatsapp.com/channel/0029VbDihpb6hENtIKIGDA2l',
    assistants: [
      { name: 'Assistant 1', phone: '+22872762951' },
      { name: 'Assistant 2', phone: '+22892599751' },
    ],
  },

  // Numéros officiels de réception et bénéficiaires
  paymentChannels: [
    { method: 'Mixx by Yas (TMoney)', number: '+22892061192', beneficiary: 'ABDOUL FAWAD' },
    { method: 'Moov Money (Flooz)', number: '+22896245556', beneficiary: 'Komlan Suifit' }, // orthographe à confirmer
  ],
};

/** Retourne true si Supabase a été configuré. */
export function isConfigured() {
  return (
    !APP_CONFIG.supabaseUrl.includes('VOTRE-PROJET') &&
    !APP_CONFIG.supabaseAnonKey.includes('VOTRE_CLE')
  );
}
