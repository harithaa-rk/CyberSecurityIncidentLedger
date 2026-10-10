const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      default: "Admin",
    },
    action: {
      type: String,
      required: true,
    },
    target: {
      type: String,
      default: "System",
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical", "success"],
      default: "info",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);