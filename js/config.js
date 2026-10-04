// js/config.js - backend + app configuration (Backend agent, SPEC §1.2).
// The game works 100% without a backend: leave CONFIG_URL / CONFIG_ANON_KEY empty
// and every online feature (telemetry, feedback, remote config) is silently disabled.
// To connect a Supabase project, see docs/ADMIN_SETUP.md (step 4).

export const APP_VERSION = '2.2.0';            // MUST equal VERSION in sw.js
export const APP_NAME = 'הילד מהשכונה';
const CONFIG_URL = 'https://emjoopohyldozggfnetb.supabase.co';                          // the owner pastes the Supabase Project URL here, e.g. 'https://abcd1234.supabase.co'
const CONFIG_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtam9vcG9oeWxkb3pnZ2ZuZXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODM0MzYsImV4cCI6MjEwNDI1OTQzNn0.G5mRLPnPe6ti0uDhIXyK8_d6pZpoDUlagotwRQdI4kg';                     // the owner pastes the anon / publishable key here (it is public by design; data is protected by RLS)
export const DEV_OVERRIDE_KEY = 'hy.dev.backend';
const dev = readDevOverride();
// {"off":true} switches every online feature off (tests use it so they never reach the real project)
export const SUPABASE_URL = dev?.off ? '' : (dev?.url || CONFIG_URL).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = dev?.off ? '' : dev?.anonKey || CONFIG_ANON_KEY;
export const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const FEEDBACK_ENABLED = true;
export const TELEMETRY_DEFAULT_ON = true;
export const HEARTBEAT_MS = 60000;

// Dev override (e2e / local testing): localStorage['hy.dev.backend'] = '{"url":"http://localhost:54321","anonKey":"mock-anon"}'
// or '{"off":true}' to run with no backend at all.
function readDevOverride() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const raw = ls.getItem(DEV_OVERRIDE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    return {
      off: v.off === true,
      url: typeof v.url === 'string' ? v.url : '',
      anonKey: typeof v.anonKey === 'string' ? v.anonKey : '',
    };
  } catch {
    return null;
  }
}
