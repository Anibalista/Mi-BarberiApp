const requiredEnvVars = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const env = {
  appName: import.meta.env.VITE_APP_NAME || "Mi BarberiApp",
  appEnv: import.meta.env.VITE_APP_ENV || "development",

  supabaseUrl: requiredEnvVars.supabaseUrl,
  supabaseAnonKey: requiredEnvVars.supabaseAnonKey,

  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

export function validateEnv() {
  const missingVars = [];

  if (!requiredEnvVars.supabaseUrl) {
    missingVars.push("VITE_SUPABASE_URL");
  }

  if (!requiredEnvVars.supabaseAnonKey) {
    missingVars.push("VITE_SUPABASE_ANON_KEY");
  }

  if (missingVars.length > 0) {
    console.warn(
      `[ENV] Faltan variables de entorno: ${missingVars.join(", ")}`
    );
  }

  return missingVars.length === 0;
}