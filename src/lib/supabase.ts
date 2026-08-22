import { portalDb } from '../api/supabaseClient';

// Compatibility shim retained for older imports.
// The application now uses the IndexedDB-backed local persistence layer.
export const supabase = portalDb;
