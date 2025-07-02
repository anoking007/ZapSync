import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey, sendAndConfirmTransaction, Connection } from "@solana/web3.js";
import base58 from "bs58";

console.log("yoooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo");

// CRITICAL FIX: Use the environment variable for the connection URL
// Ensure process.env.SOLANA_RPC_URL is set to your dedicated RPC (e.g., from Alchemy/QuickNode)
const connection = new Connection(process.env.SOLANA_RPC_URL!, "finalized");

export async function sendSol(to: string, amount: string) {
    // FIX: Ensure this matches your .env variable name (SOLANA_PRIVATE_KEY)
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Error: SOLANA_PRIVATE_KEY is not set in environment variables.");
        throw new Error("SOLANA_PRIVATE_KEY is not configured.");
    }

    const keypair = Keypair.fromSecretKey(base58.decode(privateKey));

    console.log("Solana: Sending from public key:", keypair.publicKey.toBase58());
    console.log(`Solana: Attempting to send ${amount} SOL to ${to}`);

    const lamportsAmount = parseFloat(amount) * LAMPORTS_PER_SOL;

    const MAX_RETRIES = 3; // Define maximum number of retries
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Solana: Transaction attempt ${i + 1}/${MAX_RETRIES}...`);

            // Get a fresh blockhash for each retry attempt
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

            const transferTransaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(to),
                    lamports: lamportsAmount,
                })
            );

            // Set the latest blockhash and lastValidBlockHeight for the transaction
            transferTransaction.recentBlockhash = blockhash;
            transferTransaction.lastValidBlockHeight = lastValidBlockHeight;
            transferTransaction.feePayer = keypair.publicKey; // Set fee payer

            // Sign the transaction
            transferTransaction.sign(keypair);

            const signature = await sendAndConfirmTransaction(
                connection,
                transferTransaction,
                [keypair],
                { commitment: 'confirmed', skipPreflight: false } // 'confirmed' waits for confirmation
            );

            console.log("Solana: Transaction successful! Signature:", signature);
            return; // Exit function on successful transaction
        } catch (error: any) { // Use 'any' for error type to access properties like 'name'
            console.error(`Solana: Transaction attempt ${i + 1} failed:`, error.message);

            // Check if it's the specific expiration error and if retries are left
            if (error.name === 'TransactionExpiredBlockheightExceededError' && i < MAX_RETRIES - 1) {
                const delay = 2000 * (i + 1); // Exponential backoff (2s, 4s, 6s...)
                console.log(`Solana: Transaction expired. Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // If it's a different error, or if max retries reached, re-throw
                console.error("Solana: Final attempt failed or non-retriable error.");
                throw error; // Re-throw the error so the calling function knows it ultimately failed
            }
        }
    }
}