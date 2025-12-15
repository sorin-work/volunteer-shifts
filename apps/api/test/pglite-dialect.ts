import type { PGlite } from '@electric-sql/pglite';
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
} from 'kysely';

/**
 * Minimal Kysely dialect for PGlite (Postgres compiled to WASM) so the test
 * suite runs real SQL without a database server. PGlite has a single
 * connection, so connections are handed out one at a time: a transaction keeps
 * the connection until it commits, like a row lock would on a real server.
 */
export class PGliteDialect implements Dialect {
  constructor(private readonly pglite: PGlite) {}

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new PGliteDriver(this.pglite);
  }

  createIntrospector(db: Kysely<unknown>) {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler() {
    return new PostgresQueryCompiler();
  }
}

class PGliteConnection implements DatabaseConnection {
  constructor(private readonly pglite: PGlite) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.pglite.query<R>(compiled.sql, [...compiled.parameters]);
    return {
      rows: result.rows,
      numAffectedRows: result.affectedRows !== undefined ? BigInt(result.affectedRows) : undefined,
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('streaming is not supported by the PGlite test dialect');
  }
}

class PGliteDriver implements Driver {
  private readonly connection: PGliteConnection;
  private queue: Promise<void> = Promise.resolve();
  private release: (() => void) | null = null;

  constructor(private readonly pglite: PGlite) {
    this.connection = new PGliteConnection(pglite);
  }

  async init() {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    this.release = release;
    return this.connection;
  }

  async beginTransaction(conn: DatabaseConnection) {
    await conn.executeQuery(CompiledQuery.raw('begin'));
  }

  async commitTransaction(conn: DatabaseConnection) {
    await conn.executeQuery(CompiledQuery.raw('commit'));
  }

  async rollbackTransaction(conn: DatabaseConnection) {
    await conn.executeQuery(CompiledQuery.raw('rollback'));
  }

  async releaseConnection() {
    const release = this.release;
    this.release = null;
    release?.();
  }

  async destroy() {
    await this.pglite.close();
  }
}
