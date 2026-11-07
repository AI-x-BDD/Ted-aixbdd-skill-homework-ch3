export async function findValid(conn, tokenHash, now) {
  const [rows] = await conn.query(
    `SELECT id, token_hash, user_id, expires_at
     FROM sessions
     WHERE token_hash = :tokenHash AND expires_at > :now`,
    { tokenHash, now },
  );
  return rows[0] ?? null;
}

export async function extend(conn, id, expiresAt) {
  await conn.query(
    "UPDATE sessions SET expires_at = :expiresAt WHERE id = :id",
    { expiresAt, id },
  );
}

export async function insert(conn, { userId, tokenHash, expiresAt }) {
  const [result] = await conn.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES (:tokenHash, :userId, :expiresAt)`,
    { tokenHash, userId, expiresAt },
  );
  return result.insertId;
}

export async function deleteByTokenHash(conn, tokenHash) {
  await conn.query("DELETE FROM sessions WHERE token_hash = :tokenHash", {
    tokenHash,
  });
}

export async function deleteByUser(conn, userId) {
  await conn.query("DELETE FROM sessions WHERE user_id = :userId", { userId });
}
