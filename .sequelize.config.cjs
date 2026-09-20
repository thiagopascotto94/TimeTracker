require('dotenv').config();

const rawDialect = (process.env.DB_DIALECT || '').toLowerCase();
const hasPostgresUrl = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
);
const isPostgres = rawDialect === 'postgres' || rawDialect === 'postgresql' || hasPostgresUrl;

const config = isPostgres && process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions:
        process.env.DATABASE_SSL === 'true'
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {},
    }
  : {
      dialect: 'sqlite',
      storage: process.env.DB_PATH || './database.sqlite',
      logging: false,
    };

module.exports = {
  development: config,
  test: config,
  production: config,
};
