import { PrismaClient } from '@prisma/client';
import { Kafka, Partitioners } from 'kafkajs'; // Import Partitioners for the warning fix

const prisma = new PrismaClient();

const KAFKA_BROKERS = ['localhost:9092']; // Kafka broker running on localhost:9092
const KAFKA_TOPIC = 'zap-events'; // Name of the Kafka topic we created
const KAFKA_GROUP_ID = 'main-worker-group'; // Consumer group ID

const kafka = new Kafka({
  clientId: 'zap-worker',
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({
    groupId: KAFKA_GROUP_ID,
    // CRUCIAL for manual acknowledgements: Disable auto-commit
    // This means the worker explicitly tells Kafka when it has finished processing a message
    
});

async function main() {
  console.log("Zap Worker started...");

  try {
    await consumer.connect(); // Connect Kafka consumer
    console.log("Kafka Consumer connected.");

    // Subscribe to the topic
    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });
    console.log(`Subscribed to topic: ${KAFKA_TOPIC}`);

    // Run the consumer to process messages
    await consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
        if (!message.value) {
            console.warn('Received message with null/undefined value. Skipping.');
            return;
        }

        const offset = message.offset;
        const processedMessage = message.value.toString();
        console.log(`Processing message at offset ${offset} from partition ${partition}:`);
        console.log(`Payload: ${processedMessage}`);

        try {
          // --- Simulate expensive operation (e.g., sending an email, calling an API) ---
          const workDuration = 5000; // Simulate 5 seconds of work
          console.log(`  [Worker] Simulating work for ${workDuration / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, workDuration));
          console.log(`  [Worker] Work completed for offset ${offset}.`);
          // --- End simulation ---

          // After successful processing, manually commit the offset
          // This tells Kafka that this message (and all prior messages in this partition)
          // have been successfully processed, and Kafka can move its internal pointer.
          // You commit the OFFSET of the *next* message you want to receive.
          // Hence, you add 1 to the current message's offset.
          consumer.commitOffsets([{
            topic,
            partition,
            offset: (parseInt(offset) + 1).toString(), // Convert to int, add 1, convert back to string
          }]);
          console.log(`  [Worker] Committed offset ${offset} for topic ${topic}, partition ${partition}.`);

        } catch (workError) {
          console.error(`Error processing message at offset ${offset}:`, workError);
          // If work fails, DO NOT commit the offset.
          // This ensures Kafka will redeliver the message later for retry.
          // Implement specific error handling, logging, and potentially
          // dead-letter queues or alerts for persistent failures.
        }

        // Heartbeat is important for long-running tasks within eachMessage
        // to prevent Kafka from rebalancing and re-assigning partitions.
        await heartbeat();
      },
    });

  } catch (error) {
    console.error('Fatal error in Zap Worker:', error);
    await consumer.disconnect();
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Ensure proper cleanup on process termination
process.on('SIGINT', async () => {
    console.log('SIGINT received. Disconnecting Kafka consumer...');
    await consumer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Disconnecting Kafka consumer...');
    await consumer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
});

main();