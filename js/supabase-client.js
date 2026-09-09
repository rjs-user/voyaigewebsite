/* =============================================================================
   VoyAIge Web Platform — Supabase client singleton
   Loads the Supabase JS SDK from CDN (no bundler — matches the "boring tools"
   architecture). All pages import { supabase } from here.
============================================================================= */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles OAuth + magic-link redirects
  },
});
