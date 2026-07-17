const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  }
);

async function test() {
  try {
    const { data, error } = await supabase
      .from('recruiters')
      .select('*')
      .eq('clerk_id', 'user_3Gd0DZRQ5kA9YmlL5FFTr0iwxJ6')
      .maybeSingle();
    
    console.log('Result:', JSON.stringify({ data, error: error?.message, errorCode: error?.code }));
  } catch (err) {
    console.error('CRASH:', err.message);
  }
}

test();
