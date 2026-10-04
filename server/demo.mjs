// Demo data for screenshots of the Smart assignment screen. It is only written when the server is
// started with --demo, which also switches to a separate database (data/demo.sqlite), so these people
// never appear among real accounts. Demo workers get a random password nobody knows and cannot log in.
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.mjs';

export const demoBossEmail = 'boss@demo.bandflow.invalid';

// With the default workload limits, "Design the new menu card" ranks them 94% / 58% / 31%.
const demoWorkers = [
  { name: 'Haruka', skills: ['Design'], works: ['Draw the summer poster', 'Update the logo colors'] },
  { name: 'Sara', skills: ['Design'], works: ['Lay out the lunch flyer', 'Retouch the food photos', 'Make the loyalty card', 'Draw the wall mural sketch', 'Prepare the price board', 'Pick the new uniforms', 'Refresh the table signs'] },
  { name: 'Kenji', skills: ['Programming'], works: ['Fix the order printer script'] },
];

export const seedDemo = (db, withTransaction) => {
  const bossPassword = randomBytes(6).toString('hex');
  withTransaction(() => {
    // Start from the same picture every time: demo works created earlier (including ones assigned while
    // taking screenshots) are removed and the three workers get their open works back.
    db.prepare('DELETE FROM tasks WHERE assigned_to IN (SELECT id FROM users WHERE is_demo = 1)').run();
    db.prepare("DELETE FROM users WHERE is_demo = 1 AND role = 'worker'").run();

    const boss = db.prepare('SELECT id FROM users WHERE email = ?').get(demoBossEmail);
    const bossId = boss?.id ?? randomUUID();
    if (boss) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(bossPassword), bossId);
    else db.prepare("INSERT INTO users (id, email, password_hash, full_name, role, is_demo) VALUES (?, ?, ?, 'Demo Boss', 'boss', 1)").run(bossId, demoBossEmail, hashPassword(bossPassword));

    for (const worker of demoWorkers) {
      const workerId = randomUUID();
      db.prepare("INSERT INTO users (id, email, password_hash, full_name, role, skills, is_demo) VALUES (?, ?, ?, ?, 'worker', ?, 1)")
        .run(workerId, `${worker.name.toLowerCase()}@demo.bandflow.invalid`, hashPassword(randomBytes(24).toString('hex')), worker.name, JSON.stringify(worker.skills));
      for (const title of worker.works) {
        const taskId = randomUUID();
        db.prepare(`INSERT INTO tasks (id, title, priority, due, eisenhower_category, eisenhower_source, assigned_to, created_by)
          VALUES (?, ?, 'Medium', 'Unscheduled', 'schedule', 'rules', ?, ?)`).run(taskId, title, workerId, bossId);
        db.prepare("INSERT INTO subtasks (id, task_id, description, status, order_index, started_at) VALUES (?, ?, ?, 'active', 1, CURRENT_TIMESTAMP)").run(randomUUID(), taskId, title);
      }
    }
  });
  return { bossEmail: demoBossEmail, bossPassword };
};
