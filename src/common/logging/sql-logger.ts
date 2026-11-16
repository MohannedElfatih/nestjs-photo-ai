import { Logger as NestLogger } from '@nestjs/common';
import type { Logger as TypeOrmLogger } from 'typeorm';

/**
 * Logs the SQL TypeORM runs, without the parameter values. Parameters can hold very long
 * vectors (embeddings) and sensitive data (password hashes), and the statement alone is what
 * you need to see how a query was built.
 */
export class SqlLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger('SQL');

  logQuery(query: string) {
    this.logger.log(query);
  }

  logQueryError(error: string | Error, query: string) {
    this.logger.error(`${error instanceof Error ? error.message : error}\n${query}`);
  }

  logQuerySlow(time: number, query: string) {
    this.logger.warn(`Slow query (${time} ms): ${query}`);
  }

  logSchemaBuild(message: string) {
    this.logger.log(message);
  }

  logMigration(message: string) {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    const text = String(message);
    if (level === 'warn') this.logger.warn(text);
    else this.logger.log(text);
  }
}
