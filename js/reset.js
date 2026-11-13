// Page de réinitialisation du mot de passe (fichier séparé pour la sécurité du site).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
    import { APP_CONFIG, isConfigured } from './js/config.js';

    const status = document.getElementById('status');
    const form = document.getElementById('reset-form');
    const msg = document.getElementById('reset-msg');

    if (!isConfigured()) {
      status.textContent = 'Service non configuré.';
    } else {
      const supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
        auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      });

      let ready = false;
      const showForm = () => {
        if (ready) return;
        ready = true;
        status.textContent = 'Choisissez votre nouveau mot de passe.';
        form.hidden = false;
      };

      // Le lien de l'email ouvre une session de récupération
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || session) showForm();
      });
      setTimeout(async () => {
        if (ready) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) showForm();
        else status.textContent = 'Ce lien est invalide ou a expiré. Demandez-en un nouveau depuis la page de connexion.';
      }, 2000);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('pw').value;
        const pw2 = document.getElementById('pw2').value;
        msg.hidden = true;
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(pw)) { msg.textContent = '8 caractères minimum, avec une majuscule, une minuscule et un symbole.'; msg.hidden = false; return; }
        if (pw !== pw2) { msg.textContent = 'Les deux mots de passe ne correspondent pas.'; msg.hidden = false; return; }

        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) { msg.textContent = 'Modification impossible : ' + error.message; msg.hidden = false; return; }

        // Reconnexion obligatoire avec le nouveau mot de passe
        await supabase.auth.signOut();
        form.hidden = true;
        status.textContent = 'Votre mot de passe a été modifié. Vous pouvez vous connecter.';
        status.insertAdjacentHTML('afterend', '<p><a class="btn btn-primary btn-block" href="index.html#/connexion">Se connecter</a></p>');
      });
    }
