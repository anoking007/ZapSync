import { PrismaClient } from '@prisma/client';
import { Kafka, Partitioners} from 'kafkajs';

const prisma = new PrismaClient();

// Kafka setup
const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092'] // Kafka broker running on localhost:9092
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner, // ✅ This fixes the warning
});
const TOPIC_NAME = 'zap-events'; // Name of the Kafka topic we created

async function main() {
  console.log("Outbox Processor started...");
  await producer.connect(); // Connect Kafka producer once

  while (true) {
    try {
      // 1. Poll for pending rows from the ZapRunOutbox table
      const pendingRows = await prisma.zapRunOutbox.findMany({
        where: {
          processed: false // Only pick unprocessed events
        },
        take: 10, // Limit to 10 rows per iteration to avoid overwhelming Kafka/memory
        orderBy: {
          createdAt: 'asc' // Process older events first
        }
      });

      if (pendingRows.length > 0) {
        console.log(`Found ${pendingRows.length} pending outbox entries.`);

        // 2. Map pending rows to Kafka messages
        const messages = pendingRows.map(row => ({
          value: JSON.stringify(row.payload), // Kafka message value should be a string
          key: row.zapRunId // Use zapRunId as key for partitioning (optional but good practice)
        }));

        // 3. Publish messages to Kafka
        await producer.send({
          topic: TOPIC_NAME,
          messages: messages,
        });
        console.log(`Published ${messages.length} messages to Kafka topic '${TOPIC_NAME}'.`);

        // 4. Delete processed entries from the Outbox table
        // Use deleteMany with an `in` clause for the IDs
        const deletedCount = await prisma.zapRunOutbox.deleteMany({
          where: {
            id: {
              in: pendingRows.map(row => row.id)
            }
          }
        });
        console.log(`Deleted ${deletedCount.count} processed entries from ZapRunOutbox.`);
      } else {
        // console.log("No pending outbox entries found. Waiting...");
      }

      // Wait for a short period before polling again
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
    } catch (error) {
      console.error('Error in outbox processor loop:', error);
      // Implement robust error handling:
      // - Log the error details.
      // - Potentially mark rows as 'failed_to_publish' instead of deleting immediately.
      // - Implement dead-letter queues.
      // - Add exponential backoff for retries.
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer on error
    }
  }
}

main()
  .catch(async (e) => {
    console.error('Processor experienced a fatal error:', e);
    await producer.disconnect();
    await prisma.$disconnect();
    process.exit(1);
  });