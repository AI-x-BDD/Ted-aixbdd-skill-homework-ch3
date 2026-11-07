function normalizeUser(user, roles) {
  return {
    ...user,
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
    roles,
  };
}

export async function findById(conn, id) {
  const [users] = await conn.query(
    `SELECT id, email, name, is_active, must_change_password, suspended_until_at, no_show_counted_from_at, created_at
     FROM users
     WHERE id = :id`,
    { id },
  );
  const user = users[0];
  if (!user) {
    return null;
  }
  const [roles] = await conn.query(
    "SELECT role FROM user_roles WHERE user_id = :id",
    { id },
  );
  return normalizeUser(
    user,
    roles.map((row) => row.role),
  );
}

export function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export async function findByEmail(conn, email) {
  const [users] = await conn.query(
    `SELECT id, email, name, password_hash, is_active, must_change_password, suspended_until_at, no_show_counted_from_at, created_at
     FROM users
     WHERE email = :email`,
    { email: normalizeEmail(email) },
  );
  const user = users[0];
  if (!user) {
    return null;
  }
  const [roles] = await conn.query(
    "SELECT role FROM user_roles WHERE user_id = :id",
    { id: user.id },
  );
  return normalizeUser(
    user,
    roles.map((row) => row.role),
  );
}

export async function insert(conn, user) {
  const [result] = await conn.query(
    `INSERT INTO users (email, name, password_hash, is_active, must_change_password)
     VALUES (:email, :name, :passwordHash, :isActive, :mustChange)`,
    {
      email: user.email,
      name: user.name,
      passwordHash: user.password_hash,
      isActive: user.is_active ?? 1,
      mustChange: user.must_change_password ?? 0,
    },
  );
  return result.insertId;
}

export async function replaceRoles(conn, userId, roles) {
  await conn.query("DELETE FROM user_roles WHERE user_id = :userId", {
    userId,
  });
  const extra = [
    ...new Set(roles.filter((role) => role === "reviewer" || role === "admin")),
  ];
  for (const role of extra) {
    await conn.query(
      "INSERT INTO user_roles (user_id, role) VALUES (:userId, :role)",
      { userId, role },
    );
  }
}

export async function updateName(conn, id, name) {
  await conn.query("UPDATE users SET name = :name WHERE id = :id", {
    name,
    id,
  });
}

export async function updatePassword(conn, id, hash, mustChange) {
  await conn.query(
    "UPDATE users SET password_hash = :hash, must_change_password = :mustChange WHERE id = :id",
    { hash, mustChange: mustChange ? 1 : 0, id },
  );
}

export async function lockById(conn, id) {
  const [users] = await conn.query(
    `SELECT id, email, name, is_active, must_change_password, suspended_until_at, no_show_counted_from_at
     FROM users
     WHERE id = :id
     FOR UPDATE`,
    { id },
  );
  return users[0] ?? null;
}

export async function countActiveAdmins(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n
     FROM users u
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'admin'
     WHERE u.is_active = 1`,
  );
  return Number(rows[0].n);
}

export async function list(conn, { keyword, role, limit = 200 } = {}) {
  const cap = Math.min(Number(limit) || 200, 200);
  let sql = `SELECT DISTINCT u.id, u.email, u.name, u.is_active, u.must_change_password, u.suspended_until_at, u.created_at
     FROM users u`;
  const params = { cap };
  if (role === "reviewer" || role === "admin") {
    sql += ` JOIN user_roles r ON r.user_id = u.id AND r.role = :role`;
    params.role = role;
  }
  const conditions = [];
  if (keyword) {
    conditions.push("(u.email LIKE :kw OR u.name LIKE :kw)");
    params.kw = `%${keyword}%`;
  }
  if (role === "employee") {
    conditions.push(`u.id NOT IN (SELECT user_id FROM user_roles)`);
  }
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }
  sql += " ORDER BY u.id LIMIT :cap";
  const [users] = await conn.query(sql, params);
  const result = [];
  for (const user of users) {
    const [roles] = await conn.query(
      "SELECT role FROM user_roles WHERE user_id = :id",
      { id: user.id },
    );
    result.push(
      normalizeUser(
        user,
        roles.map((row) => row.role),
      ),
    );
  }
  return result;
}

export async function setSuspension(
  conn,
  id,
  { suspendedUntil, noShowCountedFrom },
) {
  await conn.query(
    `UPDATE users
     SET suspended_until_at = :suspendedUntil, no_show_counted_from_at = :noShowCountedFrom
     WHERE id = :id`,
    { id, suspendedUntil, noShowCountedFrom },
  );
}
