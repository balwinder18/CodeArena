const mongoose = require("mongoose");

const connectdb = () => {
    // Corrected to use MONGODB_URI to match your .env file
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error(" MongoDB connection error:", err));
};

module.exports = connectdb;