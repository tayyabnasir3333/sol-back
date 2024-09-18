const {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
require("dotenv").config();
const Wallet = require("../models/wallet.model");
const bs58 = require("bs58");
const { createWalletToDB } = require("../controllers/wallet.controller");
const { bot } = require("../config/telegraf");
const { sendAmount } = require("./excessAmountSend");
const addressModel = require("../models/address.model");
const connection = new Connection(process.env.HELIUS_API_KEY, "confirmed");

const createWallet = async () => {
  try {
    await createWalletToDB();
    const unusedWallet = await Wallet.findOne({ inUsed: false });

    if (unusedWallet) {
      await unusedWallet.save();
    } else {
      const create_wallet = await Keypair.generate();
      const secretKey = bs58.encode(Uint8Array.from(create_wallet.secretKey));
      console.log("Wallet Secret Key:", secretKey);
      console.log("Wallet Public Key:", create_wallet.publicKey.toString());

      const newWallet = new Wallet({
        secretKey,
        publicKey: create_wallet.publicKey.toString(),
        inUsed: false,
      });
      await newWallet.save();
    }
  } catch (error) {
    console.log("An error occurred:", error);
    return error;
  }
};

const getBalance = async (wallet_address) => {
  try {
    const address = new PublicKey(wallet_address);
    const balance = (await connection.getBalance(address)) / LAMPORTS_PER_SOL;
    console.log("Current balance: ", balance);
    return balance;
  } catch (error) {
    console.error("An error occurred:", error);
    console.log(error);
  }
};

const sendSol = async (
  senderPrivateKey,
  recipientPublicKey,
  actualAmount,
  userId,
  refund,
) => {
  const senderAccount = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));
  const address = await addressModel.findOne({ telegramId: userId });

  console.log("senderAccount: ", senderAccount.publicKey.toString());
  // const recipientPublicKey = "2R8UAanGZpZSYcFrzkyKfm2Z5Eu8MjkFR51h6xkLCuiG"; // Recipient's public key
  const gasFee = 0.000005 * LAMPORTS_PER_SOL;
  // try {
  const balance = await connection.getBalance(senderAccount.publicKey);
  console.log("useruseruser: ", actualAmount, balance);
  if (!refund) {
    if (actualAmount > balance / LAMPORTS_PER_SOL) {
      throw new Error("lowAmount");
    } else if (actualAmount < balance / LAMPORTS_PER_SOL) {
      sendAmount(
        senderAccount,
        process.env.ADMIN_ADDRESS,
        address.address,
        actualAmount,
      );
    }
  }
  console.log("before Balance: ", balance / LAMPORTS_PER_SOL);
  if (balance === 0) {
    throw new Error("Insufficient balance");
  }
  const lamports = balance - gasFee;
  console.log("Transfer Balance: ", lamports / LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderAccount.publicKey,
      toPubkey: new PublicKey(recipientPublicKey),
      lamports: lamports,
    }),
  );
  // Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    senderAccount,
  ]);
  console.log("Transaction successful!");
  console.log("Transaction signature:", signature);
  return { signature, balance, sendAmount: balance / LAMPORTS_PER_SOL };
  // } catch (error) {
  //   console.error("An error occurred:", error);
  //   return error;
  // }
};

module.exports = { createWallet, getBalance, sendSol };
