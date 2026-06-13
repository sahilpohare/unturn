import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { Pool } from 'pg';

// Called once from AuthInfraModule.useFactory with the shared pool
export function createAuth(pool: Pool) {
  return betterAuth({
    database: pool,
    emailAndPassword: { enabled: true },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        async sendInvitationEmail(data) {
          // Wire up your mailer here
          console.log(`Invite ${data.email} → ${data.id}`);
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
