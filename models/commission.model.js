const mongoose = require("mongoose");
const commissionSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  commission: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Commission", commissionSchema);
