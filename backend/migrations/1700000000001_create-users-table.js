/**
 * Migration: create users table.
 *
 * Holds both roles (admin, employee) in a single table distinguished by the
 * `role` column, rather than separate tables — this keeps auth/queries
 * simple since both roles share almost all the same fields.
 */

exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true }); // for gen_random_uuid()

  pgm.createType('user_role', ['admin', 'employee']);

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    employee_code: {
      type: 'varchar(50)',
      unique: true,
      notNull: false, // admin accounts may not have one
    },
    name: {
      type: 'varchar(150)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    role: {
      type: 'user_role',
      notNull: true,
      default: 'employee',
    },
    department: {
      type: 'varchar(100)',
    },
    designation: {
      type: 'varchar(100)',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Case-insensitive lookups (e.g. login by email) are common — index it.
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'role');
};

exports.down = (pgm) => {
  pgm.dropTable('users');
  pgm.dropType('user_role');
};
