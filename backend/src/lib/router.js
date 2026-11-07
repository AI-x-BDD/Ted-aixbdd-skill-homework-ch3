function compile(pattern) {
  const keys = [];
  const source = pattern.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { keys, regex: new RegExp(`^${source}$`) };
}

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const { keys, regex } = compile(pattern);
    routes.push({ method, keys, regex, handler });
  }

  return {
    get: (pattern, handler) => add("GET", pattern, handler),
    post: (pattern, handler) => add("POST", pattern, handler),
    put: (pattern, handler) => add("PUT", pattern, handler),
    patch: (pattern, handler) => add("PATCH", pattern, handler),
    delete: (pattern, handler) => add("DELETE", pattern, handler),
    async handle(req, res) {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url, `http://${host}`);
      const method = req.method.toUpperCase();
      for (const route of routes) {
        if (route.method !== method) {
          continue;
        }
        const match = url.pathname.match(route.regex);
        if (!match) {
          continue;
        }
        const params = {};
        route.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1]);
        });
        req.params = params;
        req.query = Object.fromEntries(url.searchParams.entries());
        req.pathname = url.pathname;
        return route.handler(req, res);
      }
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({ message: "找不到這個資源。請確認網址後再試一次。" }),
      );
    },
  };
}
