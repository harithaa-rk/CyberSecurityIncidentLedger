const mongoose = require("mongoose");

const blockchainTransactionSchema = new mongoose.Schema(
  {
    txHash: {
      type: String,
      required: true,
      unique: true,
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    logId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Confirmed", "Pending", "Failed"],
      default: "Confirmed",
    },
    gasUsed: {
      type: Number,
      default: 21000,
    },
    contractAddress: {
      type: String,
      default: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlockchainTransaction", blockchainTransactionSchema);
