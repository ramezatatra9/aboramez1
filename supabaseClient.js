const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    console.log('✅ Supabase Client initialized successfully for:', SUPABASE_URL);
  }
} catch (err) {
  console.error('❌ Failed to initialize Supabase client:', err.message);
}

module.exports = { supabase, SUPABASE_URL, SUPABASE_KEY };
