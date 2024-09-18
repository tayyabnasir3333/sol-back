const Wallet = require("../models/wallet.model");
const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");

const createWalletToDB = async () => {
  try {
    const existingWallets = await Wallet.find();
    if (existingWallets.length < 10) {
      for (let i = 0; i < 10; i++) {
        const create_wallet = await Keypair.generate();
        const secretKey = bs58.encode(Uint8Array.from(create_wallet.secretKey));
        const publicKey = create_wallet.publicKey.toString();

        const wallet = new Wallet({ secretKey, publicKey });
        await wallet.save();
      }
      console.log("10 accounts created successfully.");
    } else {
      console.log("Accounts already exist.");
    }
  } catch (error) {
    console.error("An error occurred while creating wallets:", error);
    throw error;
  }
};

const createNewWalletToDB = async () => {
  try {
    const create_wallet = await Keypair.generate();
    const secretKey = bs58.encode(Uint8Array.from(create_wallet.secretKey));
    const publicKey = create_wallet.publicKey.toString();

    const wallet = new Wallet({ secretKey, publicKey });
    await wallet.save();
    return wallet;
  } catch (error) {
    console.error("An error occurred while creating wallets:", error);
    throw error;
  }
};

module.exports = { createWalletToDB, createNewWalletToDB };
