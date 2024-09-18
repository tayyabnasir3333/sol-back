const mongoose = require("mongoose");
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
  },
  advertisementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Advertisement",
  },
  price: {
    type: String,
    required: true,
  },
  tranxHash: {
    type: String,
    required: true,
  },
  tranxHashBackend: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
