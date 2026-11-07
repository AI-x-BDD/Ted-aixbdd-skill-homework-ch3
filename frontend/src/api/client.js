export class ApiError extends Error {
  constructor({ status, message, fields, violations, conflicts, impact }) {
    super(message);
    this.status = status;
    this.message = message;
    this.fields = fields;
    this.violations = violations;
    this.conflicts = conflicts;
    this.impact = impact;
  }
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers:
        body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      status: 0,
      message: "無法連線，請檢查網路後再試一次。",
    });
  }
  if (response.status === 401) {
    location.hash = "#/login";
  }
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ApiError({
      status: response.status,
      message: data.message ?? "操作失敗，請稍後再試。",
      fields: data.fields,
      violations: data.violations,
      conflicts: data.conflicts,
      impact: data.impact,
    });
  }
  return data;
}

export const get = (path) => request("GET", path);
export const post = (path, body) => request("POST", path, body ?? {});
export const put = (path, body) => request("PUT", path, body ?? {});
export const patch = (path, body) => request("PATCH", path, body ?? {});
export const del = (path, body) => request("DELETE", path, body);
