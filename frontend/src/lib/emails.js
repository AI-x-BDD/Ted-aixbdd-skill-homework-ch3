// 將貼上的受邀 Email 文字拆成清單（research.md R-12）：
// 以空白、逗號、分號（含全形）與換行切開，去除前後空白、轉小寫、略過空白項，
// 重複者只保留第一個。不驗證格式，帳號是否存在由後端判定。
const SEPARATORS = /[\s,，;；]+/;

export function parseInviteeEmails(text) {
  const seen = new Set();
  const emails = [];
  for (const part of String(text ?? "").split(SEPARATORS)) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    emails.push(email);
  }
  return emails;
}
