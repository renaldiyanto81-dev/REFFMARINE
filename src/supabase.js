import { createClient } from '@supabase/supabase-js';

// Isi melalui file .env.local. Jangan pernah masukkan service_role key ke frontend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);
export const supabase = isConfigured ? createClient(url, anonKey) : null;