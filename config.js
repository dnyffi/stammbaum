// ===================================================================
// Hier die zwei Werte aus dem Supabase-Dashboard eintragen:
// Project Settings -> API -> "Project URL" und "anon public" Key
// ===================================================================
window.SUPABASE_CONFIG = {
  url: 'https://gppqwlsmapwewhgdaiqn.supabase.co/rest/v1/',      // z.B. https://abcdefgh.supabase.co
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcHF3bHNtYXB3ZXdoZ2RhaXFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDY4NzQxMCwiZXhwIjoyMTA2MjYzNDEwfQ.u4ukrndImLflVogHalxBe9A7p-Lh_x4qTTwOMU48nfU',      // langer Text, beginnt meist mit "eyJ..."
  pin: 'stammbaum2026'                // Familien-PIN zum Speichern - hier aendern wenn gewuenscht
                                       // (muss exakt mit dem PIN in supabase_setup.sql uebereinstimmen!)
};
