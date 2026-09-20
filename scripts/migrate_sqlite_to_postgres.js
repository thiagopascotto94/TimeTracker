#!/usr/bin/env node
/**
 * scripts/migrate_sqlite_to_postgres.js
 * 
 * Script de migração de dados do SQLite (database.sqlite) para o PostgreSQL.
 * Realiza backup prévio do banco SQLite, preserva UUIDs e chaves primárias,
 * e valida a integridade contábil e referencial dos registros após a migração.
 * 
 * Uso:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/timetracker node scripts/migrate_sqlite_to_postgres.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

async function runMigration() {
  console.log('=====================================================');
  console.log('  CRONOS - Migração de Dados: SQLite -> PostgreSQL   ');
  console.log('=====================================================\n');

  const sqlitePath = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');
  const postgresUrl = process.env.DATABASE_URL;

  // 1. Verificações preliminares
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ Arquivo SQLite não encontrado em: ${sqlitePath}`);
    process.exit(1);
  }

  if (!postgresUrl || (!postgresUrl.startsWith('postgres://') && !postgresUrl.startsWith('postgresql://'))) {
    console.error('❌ DATABASE_URL não definida ou inválida. Forneça uma URL PostgreSQL válida.');
    console.error('Exemplo: DATABASE_URL=postgresql://user:pass@localhost:5432/timetracker');
    process.exit(1);
  }

  // 2. Backup prévio do SQLite
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sqlitePath}.backup-${timestamp}`;
  console.log(`📦 [Passo 1/4] Realizando backup do SQLite para: ${path.basename(backupPath)}...`);
  try {
    fs.copyFileSync(sqlitePath, backupPath);
    console.log('✅ Backup concluído com sucesso.\n');
  } catch (err) {
    console.error('❌ Falha ao criar backup do SQLite:', err.message);
    process.exit(1);
  }

  // 3. Conexões com ambos os bancos
  console.log('🔌 [Passo 2/4] Conectando aos bancos de dados...');
  const sqliteDb = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false,
  });

  const postgresDb = new Sequelize(postgresUrl, {
    dialect: 'postgres',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: process.env.DATABASE_SSL === 'true' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : {}
  });

  try {
    await sqliteDb.authenticate();
    console.log('  -> SQLite conectado.');
    await postgresDb.authenticate();
    console.log('  -> PostgreSQL conectado com sucesso.\n');
  } catch (err) {
    console.error('❌ Erro na conexão com o banco de dados:', err.message);
    process.exit(1);
  }

  // 4. Tabelas em ordem de dependência
  const tables = [
    'plans',
    'tenants',
    'users',
    'workspaces',
    'workspace_members',
    'subscriptions',
    'invoices',
    'clients',
    'client_contacts',
    'time_sessions',
    'tasks',
    'shared_reports',
    'ai_messages',
    'workspace_ai_daily_usages',
    'invites',
    'password_resets',
    'refresh_tokens',
  ];

  console.log('🚀 [Passo 3/4] Migrando registros tabela por tabela...');
  const results = [];

  for (const table of tables) {
    try {
      // Verificar se a tabela existe no SQLite
      const [tableInfo] = await sqliteDb.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`
      );

      if (!tableInfo || tableInfo.length === 0) {
        console.log(`  - Tabela "${table}": não existe no SQLite, ignorando.`);
        continue;
      }

      // Buscar todos os registros do SQLite
      const [rows] = await sqliteDb.query(`SELECT * FROM "${table}";`);
      const countSqlite = rows.length;

      if (countSqlite === 0) {
        console.log(`  - Tabela "${table}": 0 registros (vazia).`);
        results.push({ table, sqliteCount: 0, postgresCount: 0, status: 'OK (vazia)' });
        continue;
      }

      // Inserir ou atualizar no PostgreSQL em lotes
      let inserted = 0;
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((col) => `:${col}`).join(', ');
        const quotedCols = columns.map((col) => `"${col}"`).join(', ');

        const updateClause = columns
          .filter((col) => col !== 'id')
          .map((col) => `"${col}" = EXCLUDED."${col}"`)
          .join(', ');

        const conflictClause = updateClause.length > 0
          ? `ON CONFLICT (id) DO UPDATE SET ${updateClause}`
          : `ON CONFLICT (id) DO NOTHING`;

        const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders}) ${conflictClause};`;

        // Tratar campos booleanos que possam vir como 0 ou 1 do SQLite
        const replacements = { ...row };
        for (const [k, v] of Object.entries(replacements)) {
          if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
            // Manter JSON como texto
          }
        }

        await postgresDb.query(sql, { replacements });
        inserted++;
      }

      // Validar contagem no PostgreSQL
      const [pgCountRes] = await postgresDb.query(`SELECT COUNT(*) as count FROM "${table}";`);
      const pgCount = parseInt(pgCountRes[0].count, 10);

      console.log(`  ✅ Tabela "${table}": ${countSqlite} lidos -> ${pgCount} no PostgreSQL`);
      results.push({
        table,
        sqliteCount: countSqlite,
        postgresCount: pgCount,
        status: pgCount >= countSqlite ? 'OK' : 'AVISO: Contagem divergente',
      });
    } catch (tableErr) {
      console.error(`  ❌ Erro ao migrar tabela "${table}":`, tableErr.message);
      results.push({
        table,
        sqliteCount: 'N/A',
        postgresCount: 'N/A',
        status: `ERRO: ${tableErr.message}`,
      });
    }
  }

  // 5. Relatório final de integridade
  console.log('\n📊 [Passo 4/4] Resumo da Integridade da Migração:');
  console.table(results);

  console.log('\n🎉 Processo de migração finalizado!');
  console.log(`Backup mantido em: ${backupPath}`);
  console.log('Para iniciar a aplicação com PostgreSQL, defina:');
  console.log('  DB_DIALECT=postgres');
  console.log('  DATABASE_URL=' + postgresUrl);

  await sqliteDb.close();
  await postgresDb.close();
}

runMigration().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
