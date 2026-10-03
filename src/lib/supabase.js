import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://tyaogpqtpedbucwbjzkw.supabase.co'

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_b1UXANSyOzz5W0FCj6mL2g_0GXJ9edu'

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase configuration is missing.')
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)
