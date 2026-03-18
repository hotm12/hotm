import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const rootDir = resolve(process.cwd(), ".runtime", "embedded-postgres");
const databaseDir = resolve(rootDir, "cluster");
const metadataPath = resolve(rootDir, "connection.json");
const port = Number(process.env.EMBEDDED_POSTGRES_PORT ?? "5432");
const user = process.env.EMBEDDED_POSTGRES_USER ?? "postgres";
const password = process.env.EMBEDDED_POSTGRES_PASSWORD ?? "postgres";
const databaseName = process.env.EMBEDDED_POSTGRES_DB ?? "seller_find";

const server = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true
});

let isStopping = false;

async function ensureDatabase() {
  try {
    await server.createDatabase(databaseName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
}

async function writeMetadata() {
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        databaseDir,
        port,
        user,
        password,
        databaseName,
        connectionString: `postgresql://${user}:${password}@127.0.0.1:${port}/${databaseName}`
      },
      null,
      2
    )
  );
}

async function ensureClusterInitialised() {
  try {
    await access(resolve(databaseDir, "PG_VERSION"));
  } catch {
    await server.initialise();
  }
}

async function stopServer() {
  if (isStopping) {
    return;
  }

  isStopping = true;

  try {
    await server.stop();
  } finally {
    process.exit(0);
  }
}

async function main() {
  await mkdir(rootDir, { recursive: true });
  await ensureClusterInitialised();
  await server.start();
  await ensureDatabase();
  await writeMetadata();

  console.log(`Embedded PostgreSQL is running on 127.0.0.1:${port}`);
  console.log(
    `Connection string: postgresql://${user}:${password}@127.0.0.1:${port}/${databaseName}`
  );

  process.on("SIGINT", () => {
    void stopServer();
  });

  process.on("SIGTERM", () => {
    void stopServer();
  });

  process.stdin.resume();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
