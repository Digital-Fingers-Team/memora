import { createApp } from "./app";
import { env } from "./config";
import { connectDatabase } from "./db";

async function main() {
  await connectDatabase();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Knowledge Harvest API listening on ${env.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
