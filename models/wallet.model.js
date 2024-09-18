const mongoose = require("mongoose");
const walletSchema = new mongoose.Schema(
  {
    secretKey: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    inUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Wallet", walletSchema);
