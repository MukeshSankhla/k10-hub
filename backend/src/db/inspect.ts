import { client } from '../config/database';

async function inspectDb() {
  const tableArg = process.argv[2];

  if (!tableArg) {
    console.log('\n================== K10 HUB DATABASE OVERVIEW ==================');
    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%';"
    );
    const tableNames = tablesRes.rows.map((r: any) => r.name);

    for (const table of tableNames) {
      const countRes = await client.execute(`SELECT count(*) as count FROM ${table}`);
      console.log(` 📁 Table: ${String(table).padEnd(22)} | Rows: ${countRes.rows[0].count}`);
    }
    console.log('===============================================================\n');
    console.log('💡 Tip: Run `npm run db:inspect <tableName>` to view specific rows, e.g.:');
    console.log('   npm run db:inspect projects');
    console.log('   npm run db:inspect comments\n');
    process.exit(0);
  }

  console.log(`\n🔍 Inspecting table: "${tableArg}"...`);
  try {
    const dataRes = await client.execute(`SELECT * FROM ${tableArg} LIMIT 20`);
    if (dataRes.rows.length === 0) {
      console.log(`ℹ️ Table "${tableArg}" is currently empty (0 rows).\n`);
    } else {
      console.log(`Found ${dataRes.rows.length} row(s) (showing up to 20):\n`);
      console.dir(dataRes.rows, { depth: null, colors: true });
    }
  } catch (err: any) {
    console.error(`❌ Error querying table "${tableArg}":`, err.message);
  }
  process.exit(0);
}

inspectDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
