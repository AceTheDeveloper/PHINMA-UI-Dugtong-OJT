// Seeds (or, with --clean, puts to rest) the test data the signed-in browser
// tests use. Needs .env.local, including the four E2E_*_EMAIL test users:
//   npm run e2e:seed
//   npm run e2e:clean
// It writes only rows of its own, named "E2E", to the database in .env.local.
import { cleanE2e, seedE2e } from "../tests/e2e/support/seed.ts";

try {
  if (process.argv.includes("--clean")) {
    const { host } = await cleanE2e();
    console.log(`Put the E2E test data at ${host} to rest.`);
  } else {
    const { host, ids, newDeployment } = await seedE2e();
    console.log(
      `Seeded the E2E test data at ${host} for ${ids.today}${newDeployment ? " (a new deployment was started)" : ""}.` +
        (ids.todayLocked ? " The student's entry for today is approved and locked until tomorrow." : ""),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "The seed failed.");
  process.exit(1);
}
