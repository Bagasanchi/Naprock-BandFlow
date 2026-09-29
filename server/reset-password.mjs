// Sets a new password for any account (boss or worker) and signs that account out everywhere.
// Usage: npm run reset-password -- <email> <new password>
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, minPasswordLength } from './passwords.mjs';

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword) {
  console.error('Usage: npm run reset-password -- <email> <new password>');
  process.exit(1);
}
if (newPassword.length < minPasswordLength) {
  console.error(`The new password must be at least ${minPasswordLength} characters.`);
  process.exit(1);
}

// Same database the API server opens (see server/index.mjs).
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = process.env.DATABASE_PATH ?? process.env.BAND_FLOW_DB_PATH ?? join(projectRoot, 'data', 'bandflow.sqlite');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const user = db.prepare('SELECT id, full_name, role FROM users WHERE email = ?').get(email.trim().toLowerCase());
if (!user) {
  const known = db.prepare('SELECT email, role FROM users ORDER BY role, email').all();
  console.error(`No account uses ${email}.`);
  if (known.length) console.error(`Accounts in ${databasePath}:\n${known.map((row) => `  ${row.email} (${row.role})`).join('\n')}`);
  process.exit(1);
}

const hasResetColumn = db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'password_reset_requested_at');
db.exec('BEGIN IMMEDIATE');
try {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  if (hasResetColumn) db.prepare('UPDATE users SET password_reset_requested_at = NULL WHERE id = ?').run(user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

console.log(`Password reset for ${user.full_name} (${user.role}). They have been signed out and can now log in with the new password.`);
