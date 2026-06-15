import { nanoid } from "nanoid";
import { connectDatabase } from "./db";
import { processNextJob } from "./services/jobs";

const workerId = `worker-${nanoid(8)}`;
const intervalMs = 3000;

async function main() {
  await connectDatabase();
  console.log(`Memora worker ${workerId} started`);

  setInterval(async () => {
    try {
      await processNextJob(workerId);
    } catch (error) {
      console.error("Worker loop failed", error);
    }
  }, intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
