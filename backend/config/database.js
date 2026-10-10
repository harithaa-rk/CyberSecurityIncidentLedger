const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb+srv://CyberLedgerBC:CyberLedgerBC2005@cyberledgerbc.4gvtzma.mongodb.net/?appName=CyberLedgerBC";
    await mongoose.connect(uri);

    console.log("✅ MongoDB Atlas Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;