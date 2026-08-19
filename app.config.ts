import 'dotenv/config';

import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Delta',
  slug: config.slug ?? 'delta-mobile',
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    apiBaseUrl: process.env.API_BASE_URL ?? 'https://delta-80ht.onrender.com',
    developerEmails: process.env.DEVELOPER_EMAILS ?? '',
    openWeatherMapApiKey: process.env.OPENWEATHERMAP_API_KEY ?? '',
  },
});
