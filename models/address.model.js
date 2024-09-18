const mongoose = require("mongoose");
const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  address: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  telegramId: {
    type: String,
  },
});

module.exports = mongoose.model("Address", addressSchema);
