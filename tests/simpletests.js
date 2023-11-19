
const should = require('chai').should();
const config = require('./config');
const LLMs = require('../src/llms');

const llms = new LLMs({ key: config.openAIKey, provider : 'openAI'});

describe("Simple (Integration) Tests of SimpleLLM.js", function () {

    // change default timeout to 5 seconds
    this.timeout(5000);

    // usually takes about 3 tries for GPT to return the full set of results
    this.retries(5);

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

    const schemaParallel = {
        countries: {
            type: "array",
            definition: "Return an array of strings. Each item in the array is a country mentioned in the text given. If the same country is mentioned multiple times, only return it once. Return each country as 3 letter ISO Alpha-3 code. For example Ukraine would be UKR.",
            example: "[`ARG`, `IND`, `MEX`]",
            parallelKey: 0,
        },
        hasPeople: {
            type: "boolean",
            definition: "Return true if a specific person with a first or last name is mentioned.",
            example: "Boolean", // better to specify Boolean than say true or false as then it copy-pastes the answer here.
            parallelKey: 1,
        },
        people: {
            type: "array",
            definition: "Return an array of objects of the people mentioned. In the array include two properties 'firstName' and 'lastName'.",
            example: "[ { firstName: 'Andrew', lastName: 'Johnson' }, { firstName: 'Jordan', lastName: 'Rockerfeller' } ]",
            parallelKey: 1,
        }
    };

    it('1. Test basic country analysis call to LLM', async () => {

        // Now let's try to find some countries
        const input = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";

        // Ready, set, go!
        const prompt = llms.createPrompt(task, schema, input);
        const result = await llms.run(prompt);
        const model = result.analytics.modelId;
        console.log("With model " + model + ": ", result.response.countries);

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


    it('4. Test ability to split prompts with a parallelization key', async () => {
        
        // Now let's try to find some countries & people
        const input = "Originally born in New Jersey, Kevin Jaspal, and also lived in Bangalore. He then went to university in Vancouver (Canada) where he met his best friend Mr. Guillermo Insfran.";

        // Ready, set, go!
        const prompts = llms.createPrompts(task, schemaParallel, input);

        // check if we have two prompts returned
        prompts.should.have.lengthOf(2);

        // now run the two prompts using runMany
        const results = await llms.runMany(prompts);

        // check if we have two results
        results.should.have.lengthOf(2);
        results[0].status.should.equal('fulfilled');
        results[0].value.response.countries.should.include.members(['CAN', 'USA', 'IND']);

        results[1].status.should.equal('fulfilled');
        const response2 = results[1].value.response;
        response2.hasPeople.should.equal(true);

        response2.people.should.have.lengthOf(2);
        const name1 = response2.people[0].firstName + ' ' + response2.people[0].lastName;
        const name2 = response2.people[1].firstName + ' ' + response2.people[1].lastName;
        const names = [ name1, name2 ].should.have.members(['Kevin Jaspal', 'Guillermo Insfran']);

        return;

    });

    it('5. Test parallel spliting with the combining param', async () => {
        
        // Now let's try to find some countries & people
        const input = "Originally born in New Jersey, Kevin Jaspal, and also lived in Bangalore. He then went to university in Vancouver (Canada) where he met his best friend Mr. Guillermo Insfran.";

        // Ready, set, go!
        const prompts = llms.createPrompts(task, schemaParallel, input);

        // check if we have two prompts returned
        prompts.should.have.lengthOf(2);

        // now run the two prompts using runMany
        const results = await llms.runMany(prompts, { combine: true });

        // check if we have two results
        results.status.should.equal('fulfilled');
        results.value.response.countries.should.include.members(['CAN', 'USA', 'IND']);
        results.value.response.hasPeople.should.equal(true);
        results.value.response.people.should.have.lengthOf(2);

        return;

    });

    it('6. Testing sufficient timeout', async () => {
        
        // Now let's try to find some countries & people
        const input = "Originally born in New Jersey, Kevin Jaspal, and also lived in Bangalore. He then went to university in Vancouver (Canada) where he met his best friend Mr. Guillermo Insfran.";

        // Ready, set, go!
        const prompts = llms.createPrompts(task, schemaParallel, input);

        // check if we have two prompts returned
        prompts.should.have.lengthOf(2);

        // now run the two prompts using runMany and a sufficient timeout of 3seconds
        const results = await llms.runMany(prompts, { combine: true, timeout: 3000 });

        // check if we have two results
        results.status.should.equal('fulfilled');
        results.value.response.countries.should.include.members(['CAN', 'USA', 'IND']);
        results.value.response.hasPeople.should.equal(true);
        results.value.response.people.should.have.lengthOf(2);

        return;

    });

    it('7. Testing insufficient timeout', async () => {
        
        // Now let's try to find some countries & people
        const input = "Originally born in New Jersey, Kevin Jaspal, and also lived in Bangalore. He then went to university in Vancouver (Canada) where he met his best friend Mr. Guillermo Insfran.";

        // Ready, set, go!
        const prompts = llms.createPrompts(task, schemaParallel, input);

        // check if we have two prompts returned
        prompts.should.have.lengthOf(2);

        // now run the two prompts using runMany and a sufficient timeout of 50millions
        const results = await llms.runMany(prompts, { timeout: 50 });

        // check if we have two results
        results.should.have.lengthOf(2);
        results[0].status.should.equal('rejected');
        results[1].status.should.equal('rejected');
        results[0].reason.name.should.equal('TimeoutError');
        results[1].reason.name.should.equal('TimeoutError');

        return;

    });

    it('8. Testing retries on Timeout failure', async () => {
        
        // Now let's try to find some countries & people
        const input = "Originally born in New Jersey, Kevin Jaspal, and also lived in Bangalore. He then went to university in Vancouver (Canada) where he met his best friend Mr. Guillermo Insfran.";

        // Ready, set, go!
        const prompts = llms.createPrompts(task, schemaParallel, input);

        // check if we have two prompts returned
        prompts.should.have.lengthOf(2);


        let totalAttempts = 0;
        const onTimeout = function(attempt) {
            totalAttempts = attempt;
            // console.log(`Got a timeout on ${attempt} ....potentially retrying`);
            return;
        };

        const timeoutRetries = 3;
        // now run the two prompts using runMany and a sufficient timeout of 50millions
        const results = await llms.runMany(prompts, { timeout: 50, timeoutRetries, onTimeout });

        // check if we have two results
        results.should.have.lengthOf(2);
        results[0].status.should.equal('rejected');
        results[1].status.should.equal('rejected');
        results[0].reason.name.should.equal('TimeoutError');
        results[1].reason.name.should.equal('TimeoutError');
        totalAttempts.should.be.equal(timeoutRetries + 1);

        return;

    });

    // it('6. Test ability to set Azure endpoint', async () => {


    //     const azureLLM = new LLMs({ 
    //         key: config.azureKey, 
    //         provider : 'azure', 
    //         endpoint: config.azureEndpoint
    //     });

    //     // Now let's try to find some countries
    //     const input = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";

    //     // Ready, set, go!
    //     TODO: NEED TO SWITCH TO AZURE ENDPOINT
    //     const prompt = llms.createPrompt(task, schema, input);
    //     const result = await llms.run(prompt);
    //     console.log(result.analytics);

    //     // mainly testing if we got a decent object back
    //     result.should.have.keys(['response', 'analytics']);
    //     return;

    // });
});
