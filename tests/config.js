// config.js
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  openAIKey: process.env.openAIKey,
  azureKey: process.env.azureKey,
  azureEndpoint: process.env.azureEndpoint
}; 