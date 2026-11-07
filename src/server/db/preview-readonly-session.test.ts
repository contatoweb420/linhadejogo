import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { Duplex } from "node:stream";
import { beginPreviewReadOnlySession, endPreviewReadOnlySession,
  verifyPreviewReadOnlySession } from "./preview-readonly-session";

function fixture(options: { honorBegin?: boolean; database?: string;
  user?: string; sessionUser?: string } = {}) {
  const state = { readOnly: "off", pid: 41 };
  const statements: string[] = [];
  const execute = vi.fn(async (parts: TemplateStringsArray) => {
    const statement = parts.join("?");
    statements.push(statement);
    if (statement.startsWith("BEGIN") && options.honorBegin !== false) state.readOnly = "on";
    if (statement.startsWith("SELECT")) return [{
      database: options.database ?? "postgres", username: options.user ?? "postgres",
      session_username: options.sessionUser ?? "postgres", read_only: state.readOnly,
      backend_pid: state.pid,
    }];
    return [];
  });
  const release = vi.fn();
  const sql = Object.assign(execute, { release }) as unknown as postgres.ReservedSql;
  // Use the installed driver's real options without opening a connection.
  const driverOptions = postgres({ max: 1, fetch_types: false }).options;
  const client = { reserve: vi.fn(async () => sql), options: driverOptions };
  return { state, statements, execute, release, sql, client };
}

describe("Preview read-only connection binding", () => {
  it.each([false, true])("checks the real cold reserve lifecycle with fetch_types=%s, without network", async (fetchTypes) => {
    let startup = true;
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, done) {
        // PostgreSQL wire fixture: authentication + ready, then empty catalog
        // result + ready. No TCP socket, credentials or database is involved.
        const reply = startup
          ? "5200000008000000005a0000000549"
          : "430000000d53454c4543542030005a0000000549";
        startup = false;
        queueMicrotask(() => this.push(Buffer.from(reply, "hex")));
        done();
      },
    });
    // The installed runtime supports socket(), but its declarations omit it.
    const driverOptions: postgres.Options<Record<string, never>> & { socket: () => Duplex } = {
      socket: () => socket, ssl: false,
      max: 1, fetch_types: fetchTypes, connect_timeout: 1,
    };
    const client = postgres(driverOptions);
    let reserved: postgres.ReservedSql | undefined;
    const pending = client.reserve().then(value => { reserved = value; });
    try {
      await new Promise(resolve => setTimeout(resolve, 30));
      if (!fetchTypes) {
        expect(reserved).toBeUndefined(); // Original beforeAll timeout.
      } else {
        await pending;
        expect(reserved).toBeDefined();
        expect(reserved!.options).toBeUndefined();
        expect(() => drizzle(reserved!)).toThrow("reading 'parsers'");
        Object.assign(reserved!, { options: client.options });
        expect(drizzle(reserved!).$client).toBe(reserved);
      }
    } finally {
      reserved?.release();
      socket.destroy();
      await client.end({ timeout: 0 });
    }
  });

  it("reproduces the installed Drizzle failure and binds its parsers to the reserved executor", async () => {
    const f = fixture();
    expect(f.sql.options).toBeUndefined();
    expect(() => drizzle(f.sql)).toThrow("Cannot read properties of undefined (reading 'parsers')");
    const session = await beginPreviewReadOnlySession(f.client);
    const db = drizzle(session.sql);
    expect(db.$client).toBe(f.sql);
    expect(session.sql.options).toBe(f.client.options);
    expect(f.client.options.parsers[1184]("timestamp")).toBe("timestamp");
    await verifyPreviewReadOnlySession(session);
    await endPreviewReadOnlySession(session);
    expect(f.statements.at(-1)).toBe("ROLLBACK");
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("preserves the original setup error and releases even if rollback fails", async () => {
    const f = fixture();
    const original = new Error("setup failed");
    f.execute.mockRejectedValueOnce(original).mockRejectedValueOnce(new Error("rollback failed"));
    await expect(beginPreviewReadOnlySession(f.client)).rejects.toBe(original);
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("releases the reserved connection when final rollback fails", async () => {
    const f = fixture();
    const session = await beginPreviewReadOnlySession(f.client);
    const original = new Error("rollback failed");
    f.execute.mockRejectedValueOnce(original);
    await expect(endPreviewReadOnlySession(session)).rejects.toBe(original);
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("opens and verifies an explicit read-only transaction on the reserved connection", async () => {
    const f = fixture(); // Startup flags were not applied: initial mode is off.
    const session = await beginPreviewReadOnlySession(f.client);
    expect(session.sql).toBe(f.sql);
    expect(session.backendPid).toBe(41);
    expect(f.client.reserve).toHaveBeenCalledExactlyOnceWith();
    expect(f.statements[0]).toBe("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(f.statements[1]).toBe("SET LOCAL statement_timeout = '15s'");
    expect(f.statements[2]).toContain("transaction_read_only");
    await verifyPreviewReadOnlySession(session);
    await endPreviewReadOnlySession(session);
    expect(f.statements.at(-1)).toBe("ROLLBACK");
    expect(f.release).toHaveBeenCalledOnce();
    expect(f.statements.some(s => /\b(INSERT|UPDATE|DELETE|COMMIT)\b/.test(s))).toBe(false);
  });

  it("refuses a backend that does not enter read-only, rolls back and releases", async () => {
    const f = fixture({ honorBegin: false });
    await expect(beginPreviewReadOnlySession(f.client)).rejects.toMatchObject({ code: "READ_ONLY_OFF" });
    expect(f.statements.at(-1)).toBe("ROLLBACK");
    expect(f.release).toHaveBeenCalledOnce();
  });

  it.each([
    [{ database: "other" }, "DATABASE_MISMATCH"],
    [{ user: "other" }, "CURRENT_USER_MISMATCH"],
    [{ sessionUser: "other" }, "SESSION_USER_MISMATCH"],
  ] as const)("keeps SQL identity guards after BEGIN for %s", async (options, code) => {
    const f = fixture(options);
    await expect(beginPreviewReadOnlySession(f.client)).rejects.toMatchObject({ code });
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("rejects another backend even when its read-only flag is on", async () => {
    const f = fixture();
    const session = await beginPreviewReadOnlySession(f.client);
    f.state.pid = 42;
    await expect(verifyPreviewReadOnlySession(session)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await endPreviewReadOnlySession(session);
  });

  it("detects read-only becoming off before application queries", async () => {
    const f = fixture();
    const session = await beginPreviewReadOnlySession(f.client);
    f.state.readOnly = "off";
    await expect(verifyPreviewReadOnlySession(session)).rejects.toMatchObject({ code: "READ_ONLY_OFF" });
    await endPreviewReadOnlySession(session);
  });
});
