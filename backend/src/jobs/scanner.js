import { now } from "../clock.js";
import { withTransaction } from "../db/pool.js";

const jobs = [];
let running = false;

export function registerJob(name, fn) {
  jobs.push({ name, fn });
}

export async function runDueJobs(current) {
  for (const job of jobs) {
    try {
      await job.fn(current);
    } catch (error) {
      console.error(job.name, error);
    }
  }
}

export function startScanner({ pool: _pool, intervalMs }) {
  setInterval(() => {
    if (running) {
      return;
    }
    running = true;
    runDueJobs(now()).finally(() => {
      running = false;
    });
  }, intervalMs);
}

export async function processDue(_pool, { select, handle }) {
  for (;;) {
    const count = await withTransaction(async (conn) => {
      const [rows] =
        typeof select === "function"
          ? await select(conn)
          : await conn.query(select.sql, select.params);
      if (!rows.length) {
        return 0;
      }
      for (const row of rows) {
        try {
          await handle(conn, row);
        } catch (error) {
          console.error(error);
        }
      }
      return rows.length;
    });
    if (!count) {
      break;
    }
  }
}
