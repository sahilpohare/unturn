import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'nestdb',
});

const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true },
  plugins: [organization({ allowUserToCreateOrganization: true })],
});

export default auth;
