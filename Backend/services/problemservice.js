const Problem = require('../models/Problem.js');

const getRandomProblem = async () => {
    const count = await Problem.countDocuments();
    const randomIndex = Math.floor(Math.random() * count);
    const problem = await Problem.findOne().skip(randomIndex).lean();
    return problem;
};

const getProblemById = async (problemId) => {
    const problem = await Problem.findOne({ id: problemId }).lean();
    return problem;
};

module.exports = {
    getRandomProblem,
    getProblemById
};
