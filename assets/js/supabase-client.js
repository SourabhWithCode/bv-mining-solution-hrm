(() => {
  const config = window.HR_SUPABASE_CONFIG;
  if (!window.supabase?.createClient) throw new Error('Supabase client library did not load.');
  if (!config?.url || !config?.anonKey) throw new Error('Supabase project URL or public key is missing.');
  window.hrmClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
