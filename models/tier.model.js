const mongoose = require("mongoose");
const tierSchema = new mongoose.Schema({
  sponsor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  referral: [
    {
      user: mongoose.Schema.Types.ObjectId,
      level: String,
    },
  ],
});

module.exports = mongoose.model("Tier", tierSchema);
