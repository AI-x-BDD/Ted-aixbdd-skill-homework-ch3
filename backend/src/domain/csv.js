export function toCsv(rows) {
  const escape = (value) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    if (/[",\r\n]/.test(text)) {
      text = `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };
  const lines = rows.map((row) => row.map(escape).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}
