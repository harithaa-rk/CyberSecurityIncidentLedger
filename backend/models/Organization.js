const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "Government",
        "Private",
        "Non-Profit",
        "Educational",
        "Healthcare",
        "Financial",
        "Technology",
        "Defense",
        "Other",
      ],
      default: "Private",
    },
    sector: {
      type: String,
      default: "Cybersecurity",
    },
    contactPerson: {
      type: String,
      default: "",
      trim: true,
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending"],
      default: "Active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
