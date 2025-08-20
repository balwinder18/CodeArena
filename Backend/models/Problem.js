const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
    id: String,
    title: String,
    description: String,
    difficulty: String,
    inputFormat: String,
    outputFormat: String,
    constraints: String,
    testCases: [
        {
            input: String,
            expectedOutput: mongoose.Schema.Types.Mixed
        }
    ],
    tags: [String],
    languageSupport: [String]
});

// Use module.exports to make the model available to other files
module.exports = mongoose.model('Problem', problemSchema, 'questions');