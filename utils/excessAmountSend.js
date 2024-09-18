const {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
require("dotenv").config();
const bs58 = require("bs58");

const connection = new Connection(process.env.HELIUS_API_KEY, "finalized");
const gasFee = 0.000005 * LAMPORTS_PER_SOL;

async function sendAmount(
  senderAccount,
  adminAccount,
  userAccount,
  amountSendToAdmin,
) {
  try {
    const balance = await connection.getBalance(senderAccount.publicKey);
    const amountToRefund =
      balance - amountSendToAdmin * LAMPORTS_PER_SOL - gasFee;
    console.log("before Balance: ", balance / LAMPORTS_PER_SOL);
    console.log("gasFee: ", gasFee / LAMPORTS_PER_SOL);
    console.log("amountSendToAdmin: ", amountSendToAdmin);
    console.log("amountToRefund: ", amountToRefund / LAMPORTS_PER_SOL);

    if (balance === 0) {
      throw new Error("Insufficient balance");
    }
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderAccount.publicKey,
        toPubkey: new PublicKey(adminAccount),
        lamports: amountSendToAdmin * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: senderAccount.publicKey,
        toPubkey: new PublicKey(userAccount),
        lamports: amountToRefund,
      }),
    );
    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      senderAccount,
    ]);
    console.log("Transaction successful!");
    console.log("Transaction signature:", signature);
  } catch (error) {
    console.error("An error occurred:", error);
    return error;
  }
}

module.exports = { sendAmount };
