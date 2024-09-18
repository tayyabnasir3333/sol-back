const { Connection, PublicKey } = require("@solana/web3.js");
require("dotenv").config();

const connection = new Connection(process.env.HELIUS_API_KEY, "confirmed");
const getTransactionsBackend = async (address) => {
  try {
    const pubKey = new PublicKey(address);
    let transactionList = await connection.getSignaturesForAddress(pubKey);
    const signatures = transactionList.map((tx) => tx.signature);
    console.log("Transaction Signatures: ", signatures);
    return signatures;
  } catch (error) {
    console.log("Error Finding Transaction: ", error);
  }
};

module.exports = { getTransactionsBackend };
