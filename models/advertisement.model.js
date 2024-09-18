const mongoose = require("mongoose");
const advertisementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pricingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pricing",
    },
    solanaAddress: {
      type: String,
      required: true,
    },
    text: {
      type: String,
    },
    websiteLink: {
      type: String,
    },
    telegramLink: {
      type: String,
    },
    twitterLink: {
      type: String,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    attachments: [
      {
        link: { type: String },
        uuid: { type: String },
        order: Number,
      },
    ],
    animations: [
      {
        link: { type: String },
        uuid: { type: String },
        order: Number,
      },
    ],
    videos: [
      {
        link: { type: String },
        uuid: { type: String },
        order: Number,
      },
    ],
    link: {
      type: String,
    },
    publications: {
      type: String,
    },
    status: {
      type: String,
      default: "Not Approved",
    },
    payment: {
      recieptAmount: {
        type: String,
      },
      recieptLink: {
        type: String,
      },
      status: {
        type: String,
      },
    },
    tokenName: {
      type: String,
    },
    symbol: {
      type: String,
    },
    priceUsd: {
      type: String,
    },
    volume: {
      type: String,
    },
    marketCapUsd: {
      type: String,
    },
    tfh: {
      type: String,
    },
    holders: {
      type: String,
    },
    chartURL: {
      type: String,
    },
    buyURL: {
      type: String,
    },
    ownerInfo: {
      type: String,
    },
    tax: {
      type: String,
    },
    mintAuthority: {
      type: String,
    },

    pools: [
      {
        pool: {
          type: Number,
        },
        liquidity: {
          type: String,
        },
        age: {
          type: String,
        },
        lpBurn: {
          type: String,
        },
      },
    ],
    postIdIncremental: {
      type: Number,
      default: 1,
    },
    totalPublications: {
      type: Number,
      default: 0,
    },
    publishedCount: {
      type: Number,
      default: 0,
    },
    lastPublishedTime: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Pre-save hook to increment postIdIncremental before saving a new document
advertisementSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      // Check if the document is new
      const lastDoc = await this.constructor.findOne(
        {},
        {},
        { sort: { createdAt: -1 } },
      ); // Find the last document
      if (lastDoc) {
        this.postIdIncremental = lastDoc.postIdIncremental + 1; // Increment postIdIncremental
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Advertisement", advertisementSchema);
