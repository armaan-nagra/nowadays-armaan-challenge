/**
 * Applies supabase/migrations/*.sql in filename order against SUPABASE_DB_URL.
 * Usage: npm run db:migrate
 */
import { config } from "dotenv";
import { Client } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.local", override: true });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler URI)");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(
    `create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`
  );
  const applied = new Set(
    (await client.query(`select name from _migrations`)).rows.map((r) => r.name)
  );
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    console.log(`apply   ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(`insert into _migrations (name) values ($1)`, [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  await client.end();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
