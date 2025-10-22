import * as SQLite from 'expo-sqlite';

interface Migration {
  version: number;
  description: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
  down?: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

export class DatabaseMigration {
  private migrations: Migration[] = [
    {
      version: 1,
      description: 'Initial database schema',
      up: async (db: SQLite.SQLiteDatabase) => {
        // Create bio table
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS bio (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        // Create memories table
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            tags TEXT NOT NULL,
            summary TEXT NOT NULL,
            key_terms TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_message_at TEXT NOT NULL
          );
        `);

        // Create messages table
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            thinking TEXT,
            model TEXT,
            FOREIGN KEY (chat_id) REFERENCES memories (id) ON DELETE CASCADE
          );
        `);

        // Create indexes
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
          CREATE INDEX IF NOT EXISTS idx_memories_last_message_at ON memories(last_message_at);
          CREATE INDEX IF NOT EXISTS idx_memories_key_terms ON memories(key_terms);
        `);
      }
    },
    {
      version: 2,
      description: 'Add settings and preferences table',
      up: async (db: SQLite.SQLiteDatabase) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'string',
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
        `);
      }
    },
    {
      version: 3,
      description: 'Add gists and sharing tables',
      up: async (db: SQLite.SQLiteDatabase) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS gists (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            gist_id TEXT NOT NULL,
            gist_url TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            content TEXT NOT NULL,
            is_public INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES memories (id) ON DELETE CASCADE
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_gists_chat_id ON gists(chat_id);
          CREATE INDEX IF NOT EXISTS idx_gists_gist_id ON gists(gist_id);
        `);
      }
    },
    {
      version: 4,
      description: 'Add token usage tracking',
      up: async (db: SQLite.SQLiteDatabase) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS token_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES memories (id) ON DELETE CASCADE
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_token_usage_chat_id ON token_usage(chat_id);
          CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
        `);
      }
    },
    {
      version: 5,
      description: 'Add branch management for code mode',
      up: async (db: SQLite.SQLiteDatabase) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            repository TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            last_activity TEXT NOT NULL,
            pr_url TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES memories (id) ON DELETE CASCADE
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_branches_chat_id ON branches(chat_id);
          CREATE INDEX IF NOT EXISTS idx_branches_repository ON branches(repository);
        `);
      }
    },
    {
      version: 6,
      description: 'Add codespace tracking',
      up: async (db: SQLite.SQLiteDatabase) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS codespaces (
            id TEXT PRIMARY KEY,
            repository TEXT NOT NULL,
            codespace_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            state TEXT NOT NULL,
            web_url TEXT NOT NULL,
            last_activity TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_codespaces_repository ON codespaces(repository);
          CREATE INDEX IF NOT EXISTS idx_codespaces_state ON codespaces(state);
        `);
      }
    }
  ];

  async migrate(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
      // Create migration tracking table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // Get current version
      const result = await db.getFirstAsync<{ version: number }>(
        'SELECT MAX(version) as version FROM schema_migrations'
      );
      const currentVersion = result?.version || 0;

      console.log(`Current database version: ${currentVersion}`);

      // Apply pending migrations
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          console.log(`Applying migration ${migration.version}: ${migration.description}`);
          await migration.up(db);
          
          // Record migration
          await db.runAsync(
            'INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)',
            [migration.version, migration.description, new Date().toISOString()]
          );
          
          console.log(`Migration ${migration.version} applied successfully`);
        }
      }

      console.log('Database migration completed');
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  async rollback(db: SQLite.SQLiteDatabase, targetVersion: number): Promise<void> {
    try {
      // Get current version
      const result = await db.getFirstAsync<{ version: number }>(
        'SELECT MAX(version) as version FROM schema_migrations'
      );
      const currentVersion = result?.version || 0;

      if (targetVersion >= currentVersion) {
        console.log('No rollback needed');
        return;
      }

      console.log(`Rolling back from version ${currentVersion} to ${targetVersion}`);

      // Apply rollback migrations in reverse order
      for (const migration of this.migrations.reverse()) {
        if (migration.version <= currentVersion && migration.version > targetVersion) {
          if (migration.down) {
            console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
            await migration.down(db);
            
            // Remove migration record
            await db.runAsync(
              'DELETE FROM schema_migrations WHERE version = ?',
              [migration.version]
            );
            
            console.log(`Migration ${migration.version} rolled back successfully`);
          } else {
            console.warn(`No rollback defined for migration ${migration.version}`);
          }
        }
      }

      console.log('Database rollback completed');
    } catch (error) {
      console.error('Database rollback failed:', error);
      throw error;
    }
  }

  getCurrentVersion(): number {
    return Math.max(...this.migrations.map(m => m.version));
  }

  getPendingMigrations(currentVersion: number): Migration[] {
    return this.migrations.filter(m => m.version > currentVersion);
  }
}

export const databaseMigration = new DatabaseMigration();