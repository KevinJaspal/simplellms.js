
const should = require('chai').should();
const config = require('./config');
const LLMs = require('../src/llms');

const llms = new LLMs({ key: config.openAIKey, provider : 'openAI'});

describe("Simple (Integration) Tests of SimpleLLM.js", function () {

    // change default timeout to 5 seconds
    this.timeout(5000);

    // usually takes about 3 tries for GPT to return the full set of results
    this.retries(10);

    // Create your task
    const task = 'Your task is to analyze the text given and extract ALL the countries mentioned.' + 
    'Use your knowledge to determine a country if a city or region is mentioned.';

    // Define the schema of the JSON you would like returned
    const schema = {
        countries: {
            type: "array",
            definition: "Return an array of strings. Each item in the array is a country mentioned in the text given. If the same country is mentioned multiple times, only return it once. Return each country as 3 letter ISO Alpha-3 code. For example Ukraine would be UKR.",
            example: "[`ARG`, `IND`, `MEX`]"
        }
    };

    it('1. Test basic country analysis call to LLM', async () => {

        // Now let's try to find some countries
        const input = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";

        // Ready, set, go!
        const prompt = llms.createPrompt(task, schema, input);
        const result = await llms.run(prompt);
        console.log(result.response.countries);

        result.should.have.keys(['response', 'analytics']);
        result.response.should.have.property('countries');
        result.response.countries.should.include.members(['CAN', 'USA', 'IND']);
        return;
    });

    it('2. Ensure analytics has key details', async () => {

        // Now let's try to find some countries
        const input = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";

        // Ready, set, go!
        const prompt = llms.createPrompt(task, schema, input);
        const result = await llms.run(prompt);
        console.log(result.analytics);

        result.should.have.keys(['response', 'analytics']);
        result.analytics.should.include.keys(['promptChars', 'completionChars', 'promptTokens', 'completionTokens']);
        result.analytics.should.include.keys(['latencyMillis', 'modelId', 'totalTokens']);
        return;
    });

    it('3. Test running many prompts with runMany', async () => {

        // Now let's try to find some countries
        const inputOne = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";
        const inputTwo = "Lived in both Buenos Aires and Sao Paulo";

        // Ready, set, go!
        const promptOne = llms.createPrompt(task, schema, inputOne);
        const promptTwo = llms.createPrompt(task, schema, inputTwo);
    
        const [ resultOne, resultTwo ] = await llms.runMany([promptOne, promptTwo]);

        resultOne.status.should.equal('fulfilled');
        resultOne.value.should.have.keys(['response', 'analytics']);
        resultOne.value.response.countries.should.include.members(['CAN', 'USA', 'IND']);

        resultTwo.status.should.equal('fulfilled');
        resultTwo.value.should.have.keys(['response', 'analytics']);
        resultTwo.value.response.countries.should.include.members(['ARG', 'BRA']);

        return;
    });

    it('4. Test ability to set Azure endpoint', async () => {


        const azureLLM = new LLMs({ 
            key: config.azureKey, 
            provider : 'azure', 
            endpoint: config.azureEndpoint
        });

        // Now let's try to find some countries
        const input = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";

        // Ready, set, go!
        const prompt = llms.createPrompt(task, schema, input);
        const result = await llms.run(prompt);
        console.log(result.analytics);

        // mainly testing if we got a decent object back
        result.should.have.keys(['response', 'analytics']);
        return;

    });
});
