// supabase-config.js
const SUPABASE_URL = 'https://cixxcbmdypticjyjqjro.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XDr8umECtXBnLLcFXE1d1g_CI7E2OPN';

// สร้างตัวแปร supabase เพื่อใช้เชื่อมต่อ
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);