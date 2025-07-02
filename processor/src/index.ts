// processor/src/index.ts

import { PrismaClient } from '@prisma/client';
import { Kafka, Partitioners } from 'kafkajs';

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

const TOPIC_NAME = 'zap-events';

async function main() {
  console.log("Zap Outbox Processor started...");
  await producer.connect();

  while (true) {
    try {
      // 1. Find unprocessed ZapRunOutbox rows
      const zapRuns = await prisma.zapRunOutbox.findMany({
        where: {
          processed: false,
        },
        take: 10,
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (zapRuns.length > 0) {
        console.log(`Found ${zapRuns.length} unprocessed zap runs.`);

        const messages = zapRuns.map((run) => ({
          value: JSON.stringify({
            zapRunId: run.zapRunId,
            stage: 0, // ✅ important: worker expects this format
          }),
          key: run.zapRunId,
        }));

        await producer.send({
          topic: TOPIC_NAME,
          messages: messages,
        });

        console.log(`Published ${messages.length} zap runs to Kafka.`);

        // 2. Mark the zap runs as processed (DON’T DELETE if worker needs retry later)
        await prisma.zapRunOutbox.updateMany({
          where: {
            id: {
              in: zapRuns.map((row) => row.id),
            },
          },
          data: {
            processed: true,
          },
        });

        console.log(`Marked ${zapRuns.length} zap runs as processed.`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error in Zap Outbox Processor:', error);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

main()
  .catch(async (e) => {
    console.error('Fatal error in processor:', e);
    await producer.disconnect();
    await prisma.$disconnect();
    process.exit(1);
  });
