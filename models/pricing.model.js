const mongoose = require("mongoose");
const pricingSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  publications: {
    type: Number,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  discount: {
    type: String,
    required: false,
  },
  status: {
    type: Boolean,
    default: true,
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Pricing", pricingSchema);
