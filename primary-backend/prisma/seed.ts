/// <reference types="node" />

// primary-backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // Delete existing data to prevent duplicates on re-seeding
  // Order matters for deletion due to foreign key constraints

  // 1. Delete `ZapRunOutbox` first, as it likely has a foreign key to `ZapRun`.
  //    (This was the cause of your previous P2003 error)
  await prisma.zapRunOutbox.deleteMany({}); // ADDED: This line, assuming ZapRunOutbox exists and links to ZapRun

  // 2. Delete `ZapRun` next, as it likely has foreign keys to `Zap`, `Trigger`, and `Action`.
  await prisma.zapRun.deleteMany({});

  // 3. Delete `Action` and `Trigger`. They both link to `Zap`.
  //    The order between them usually doesn't matter unless one links to the other.
  await prisma.action.deleteMany({});
  await prisma.trigger.deleteMany({});

  // 4. Delete `Zap`, as it links to `User`.
  await prisma.zap.deleteMany({});

  // 5. Delete `User`, as it's a "parent" table with no outgoing foreign keys shown here.
  await prisma.user.deleteMany({});

  // 6. Delete `AvailableAction` and `AvailableTrigger`. These are often independent "lookup" tables.
  await prisma.availableAction.deleteMany({});
  await prisma.availableTrigger.deleteMany({});

  // [MARK] Seed Available Triggers
  const webhookTrigger = await prisma.availableTrigger.create({
    data: {
      id: 'webhook-trigger',
      name: 'Webhook',
      image: 'https://www.svix.com/resources/assets/images/color-webhook-240-1deccb0e365ff4ea493396ad28638fb7.png'   },
  });
  console.log(`Created Webhook trigger with id: ${webhookTrigger.id}`);

  const solanaAction = await prisma.availableAction.create({
    data: {
      id: 'solana-action',
      name: 'Dispense Solana',
      image: 'https://www.creativefabrica.com/wp-content/uploads/2021/06/16/Cryptocurrency-Solana-Logo-Graphics-13460284-1-1-580x435.jpg'   },
  });
  console.log(`Created Solana action with id: ${solanaAction.id}`);

  const emailAction = await prisma.availableAction.create({
    data: {
      id: 'email-action',
      name: 'Send Email',
      image: 'https://t4.ftcdn.net/jpg/09/82/07/11/360_F_982071173_oTETgokPvxjDQysPY3QEppuA0TYoYjk6.jpg'    },
  });
  console.log(`Created Email action with id: ${emailAction.id}`);

  // [MARK] Seed a User
  const user = await prisma.user.create({
    data: {
      id: '1', // Use a consistent user ID
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword', // ADDED: A dummy password since it's required by your schema
    },
  });
  console.log(`Created user with id: ${user.id}`);

  // [MARK] Seed a Zap (Link trigger and actions)
  // This Zap ID MUST match the one your hooks service uses: f3bdc0a9-e813-4069-a5ca-88636aa70fd6
  const zap = await prisma.zap.create({
    data: {
      id: 'f3bdc0a9-e813-4069-a5ca-88636aa70fd6', // This is your Zap ID
      userId: user.id,
      name: 'My Solana PR Notifier',
      isEnabled: true,
    },
  });
  console.log(`Created zap with id: ${zap.id}`);

  // [MARK] Seed the Trigger for the Zap
  await prisma.trigger.create({
    data: {
      zapId: zap.id,
      availableTriggerId: webhookTrigger.id,
      // No specific metadata needed for a basic webhook trigger, but could be added if it had options
    },
  });
  console.log(`Created trigger for zap: ${zap.id}`);

  // [MARK] Seed the Actions for the Zap - THIS IS THE CRUCIAL PART FOR METADATA
  // Action 1: Send Solana
  await prisma.action.create({
    data: {
      zapId: zap.id,
      availableActionId: solanaAction.id, // 'solana-action'
      order: 1, // First action in the sequence
      sortingOrder: 0,
      metadata: {
        // These are the templated strings the worker expects
        amount: '{{comment.amount}}',
        address: '{{comment.address}}',
      },
    },
  });
  console.log(`Created Solana action for zap: ${zap.id}`);

  // Action 2: Send Email (Optional, but good for completeness as per previous discussion)
  await prisma.action.create({
    data: {
      zapId: zap.id,
      availableActionId: emailAction.id, // 'email-action'
      order: 2, // Second action in the sequence
      sortingOrder: 1,
      metadata: {
        // These are the templated strings the worker expects
        email: '{{comment.email}}',
        subject: 'New PR Notification', // Example subject
        body: 'A new PR has been opened by {{comment.email}}. Amount: {{comment.amount}}. PR Link: {{comment.pr_link}}',
      },
    },
  });
  console.log(`Created Email action for zap: ${zap.id}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });