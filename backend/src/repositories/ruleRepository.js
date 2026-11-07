export async function loadAll(conn) {
  const [rows] = await conn.query(
    "SELECT rule_key, int_value, updated_at, updated_by FROM rules",
  );
  const snapshot = {};
  for (const row of rows) {
    snapshot[row.rule_key] = row;
  }
  return snapshot;
}

export async function update(
  conn,
  ruleKey,
  value,
  { actorUserId, now: current },
) {
  await conn.query(
    "UPDATE rules SET int_value = :value, updated_at = :now, updated_by = :actorUserId WHERE rule_key = :ruleKey",
    { value, now: current, actorUserId, ruleKey },
  );
}

export async function insertChange(conn, change) {
  await conn.query(
    `INSERT INTO rule_changes (rule_key, actor_user_id, changed_at, old_value, new_value)
     VALUES (:ruleKey, :actorUserId, :changedAt, :oldValue, :newValue)`,
    {
      ruleKey: change.rule_key,
      actorUserId: change.actor_user_id,
      changedAt: change.changed_at,
      oldValue: change.old_value,
      newValue: change.new_value,
    },
  );
}

export async function listChanges(conn, { limit = 20, beforeId } = {}) {
  const [countRows] = await conn.query(
    "SELECT COUNT(*) AS total FROM rule_changes",
  );
  const total = Number(countRows[0]?.total ?? 0);
  if (beforeId) {
    const [rows] = await conn.query(
      `SELECT c.*, u.name AS actor_name FROM rule_changes c
       JOIN users u ON u.id = c.actor_user_id
       WHERE c.id < :beforeId ORDER BY c.changed_at DESC, c.id DESC LIMIT :limit`,
      { beforeId, limit },
    );
    return { items: rows, total };
  }
  const [rows] = await conn.query(
    `SELECT c.*, u.name AS actor_name FROM rule_changes c
     JOIN users u ON u.id = c.actor_user_id
     ORDER BY c.changed_at DESC, c.id DESC LIMIT :limit`,
    { limit },
  );
  return { items: rows, total };
}
