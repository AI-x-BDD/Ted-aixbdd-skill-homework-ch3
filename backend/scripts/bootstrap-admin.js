import { config } from "../src/config.js";
import { withTransaction } from "../src/db/pool.js";
import { hashPassword } from "../src/lib/password.js";
import * as userRepository from "../src/repositories/userRepository.js";

const email = userRepository.normalizeEmail(config.ADMIN_BOOTSTRAP_EMAIL);
const password = config.ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password) {
  console.error("請設定 ADMIN_BOOTSTRAP_EMAIL 與 ADMIN_BOOTSTRAP_PASSWORD。");
  process.exit(1);
}

await withTransaction(async (conn) => {
  const admins = await userRepository.countActiveAdmins(conn);
  if (admins > 0) {
    console.log("系統已有管理員，略過建立。");
    return;
  }
  const id = await userRepository.insert(conn, {
    email,
    name: "系統管理員",
    password_hash: await hashPassword(password),
    is_active: 1,
    must_change_password: 0,
  });
  await userRepository.replaceRoles(conn, id, ["admin"]);
  console.log(`已建立管理員帳號：${email}`);
});

process.exit(0);
