-- Update PIN hash for admin_pin to match Edge Function salt 'IMF-salt-2026'
-- PIN: 6138
-- Hash: SHA256('6138' + 'IMF-salt-2026')

UPDATE admin_config 
SET pin_hash = '23c35b05b9bb6091daf45d189f3c0ea21aab8c75e086412e0d431e92d7f08a6b',
    updated_at = now()
WHERE key = 'admin_pin';

-- Verify
SELECT key, pin_hash, updated_at FROM admin_config WHERE key = 'admin_pin';
