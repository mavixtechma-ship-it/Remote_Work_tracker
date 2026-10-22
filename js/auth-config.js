// PresenceHub demo accounts. Only salted PBKDF2-SHA256 hashes live here (never plaintext).
// Regenerate an entry with: node tools/hash-password.mjs <username> <admin|viewer>
// NOTE: this is a client-side demo access gate, not real security; a static site has no server to enforce it.
'use strict';
window.PH_AUTH_CONFIG = Object.freeze({
  algorithm: 'PBKDF2-SHA256',
  sessionMinutes: 120,
  users: Object.freeze([
    Object.freeze({ username: 'admin', role: 'admin', iterations: 310000, salt: 'CaOtSPV8dgtzPf6hHKIGqA==', hash: 'x6haVwuO+tpjbB01NJLse15ra3Cf77EiFkIczLvla0E=' }),
    Object.freeze({ username: 'viewer', role: 'viewer', iterations: 310000, salt: 'KebfQ9BIPpm7+JOOjIeECg==', hash: '5VX99hBcHpjSysGgkxujjP7tjW0+QlWJrdmfnNI7TEU=' }),
  ]),
});
