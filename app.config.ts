import 'dotenv/config';

export default {
  expo: {
    name: 'Delta',
    slug: 'delta-mobile',
    extra: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
      apiBaseUrl: process.env.API_BASE_URL ?? 'https://delta-80ht.onrender.com',
      developerEmails: process.env.DEVELOPER_EMAILS ?? '',
      openWeatherMapApiKey: process.env.OPENWEATHERMAP_API_KEY ?? '',
      eas: {
        projectId: '5581a780-7a3e-4e5a-820f-ebd32f2f484f',
      },
    },
  },
};
