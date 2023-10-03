// Import Azure version of the SDK
const { OpenAIClient, OpenAIKeyCredential, AzureKeyCredential } = require("@azure/openai");

// uncomment to set Azure logger level to info. Only use for development please.
// const { setLogLevel } = require("@azure/logger");
// setLogLevel("info");

const _ = require('lodash');

// Import helper libraries
const P = require('./utils/promises');
const dJSON = require('./utils/dirtyJson');

class LLM {

    /**
     * Example format of apiKey if openAI 
     * {
     *      "key": "XYZ",
     *      "provider": "openai"
     * }
     * 
     * Example format of apiKey if azure 
     * {
     *      "key": "XYZ",
     *      "provider": "azure",
     *      "endpoint" : "https://path.to.endpoint"
     * }
     * 
     * @param {*} apiKey 
     */
    constructor(apiKey) {

        this.openai = null;
        if (apiKey.provider === 'azure') {
            this.openai = new OpenAIClient(apiKey.endpoint, new AzureKeyCredential(apiKey.key));
        }
        else {
            this.openai = new OpenAIClient(new OpenAIKeyCredential(apiKey.key));
        }

        this.intro = `
            You speak perfect single line JSON only. You will read a JSON file and return a valid single line JSON after following the instructions step by step.
        `;

        this.laws = `
            You will abide by the following laws:
            Law 1: You will not ask the user to give you more information
            Law 2: You will not mention JSON or that you are doing a JSON analysis
            Law 3: You must always only return responses in JSON format, and you must avoid providing a json 
            that may trigger an Unexpected end of JSON input error.
            Law 4: You will always return all attributes specified to the best of your ability. Use null and empty array sparingly if not given enough info
            Law 5: Remove any bullet points, special characters for any strings returned
            Law 6: You will not return the example given as an answer.
            Law 7: If you are not given enough information it is better to return less information and potentially return null for that specific attribute.
        `;

        this.inputIntro = `
            This is the JSON that contains information to be used for your task: 
        `

        this.defaultModels = [
            {
                "contextSize": "4K",
                "models" : [
                    "gpt-3.5-turbo-0301",
                    "gpt-3.5-turbo-0613"
                ]
            },
            {
                "contextSize": "16K",
                "models" : [
                    "gpt-3.5-turbo-16k-0613"
                ]
            }
        ]
    }

    /**
     * 
     * @param {*} prompts 
     * @param {*} mode 
     * @param {*} opts - {
     *                 "combine" : returns as one combined object for easy usage. By default fails-open
     *                              by combining the results that succeeded
     *            }
     * @returns 
     */
    async runMany(prompts, mode='serial', opts = {}) {
        const promises = prompts.map(prompt => {
            return this.run(prompt);
        });

        let results = null;
        if (mode === 'parallel') {
            results = await Promise.allSettled(promises);
        } else {
            // assume it is serial otherwise
            results = await P._series(promises);
        }

        let combined = {}
        let analytics = {}
        if (opts.combine === true) {
            for (let i in results) {
                if (results[i].status === 'fulfilled') {
                    combined = { 
                        ...combined,
                        ...results[i].value.response
                    }

                    analytics[i] = results[i].value.analytics;
                }
            }

            // return a similar object to what is returned with a 
            // single result
            return {
                status: 'fulfilled',
                value: {
                    response: combined,
                    analytics
                }
            };

        }

        return results;

    }


    async run(prompt) {

        const maxTokens = 500;

        try {
            const startTime = Date.now();
            const fPrompt = this._format(prompt);
            const size = this._determineContextSize(prompt, maxTokens);
            const modelId = this._rotateModelsId(size);

            const response = await this.openai.getChatCompletions(
                 // This should be the deployment ID of your model
                 modelId,
                [
                    {
                        role: "user",
                        content: fPrompt
                    }
                ],
                {
                    temperature: 0.5,
                    maxTokens: maxTokens,
                    topP: 0.6,
                    frequencyPenalty: 0.0,
                    presencePenalty: 0.0
                }
            );
            const endTime = Date.now();

            let result = [];
            for (const choice of response.choices) {
                const message = choice.message?.content;
                if (message !== undefined) {
                    result.push(message);
                }
            }

            const stringResult = result.join(' ');

            const latencyMillis = endTime - startTime;
            const analytics = {
                "promptChars": prompt.length,
                "completionChars": stringResult.length,
                "latencyMillis": latencyMillis,
                "modelId": modelId,
                ...response.usage
            }

            if (_.isEmpty(stringResult)) {
                return { response: null, analytics };
            }

    
            try {

                const json = dJSON.parse(stringResult);
                return { response: json, analytics };

            } catch (error) {
                console.log("ERROR! Had the following error in parsing updated json. JSON & Error below.")
                console.log(stringResult);
                console.log(error);

                // failing open by returning null
                return { response: null, analytics };
            }

        } catch (error) {
            console.error("Error analyzing prompt:", error);

            // failing open by returning null
            return { response: null, analytics: null };
        }
    }

    createPrompts(task, schema, input, opts = {}) {

        // splits the schema params based on the value determined in "parallelKey" property
        const splitSchema = {}

        for (let key in schema) {
            if (schema[key].parallelKey != null) {
                const splitKey = schema[key].parallelKey;

                if (splitSchema[splitKey] === undefined ) {
                    // create new object with split key
                    splitSchema[splitKey] = {};
                    splitSchema[splitKey][key] = schema[key];
                }
                else {
                    // add property to already created splitKey
                    splitSchema[splitKey][key] = schema[key];
                }
            }
        }

        const prompts = [];
        for (let splitKey in splitSchema) {
            const schema = splitSchema[splitKey];
            const prompt = this.createPrompt(task, schema, input, opts = {});
            prompts.push(prompt);
        }

        return prompts;
    }

    /**
     * 
     * @param {*} task 
     * @param {*} definitions 
     * @param {*} input 
     * @param {*} opts {
     *                 additionalLaws: [],
     *            }
     */
    createPrompt(task, schema, input, opts = {}) {

        const { paramList, stringified, example } = this._createDefinition(schema);

        const render = `
            ${this.intro}

            ${this.laws}

            ${task}

            Instructions for how analyze the request.
                You will return a JSON that contains the following attributes in this order:
                ${paramList}

            The attributes have the following definitions, please read carefully.
            ${stringified}

            ${opts.additionalLaws}

            Example of the structure you should return:
            ${JSON.stringify(example)}

            ${this.inputIntro} 

            ${JSON.stringify(input)}
        `

        return render;
    }

    // Using a buffer of 0 by default seems to be okay if we keep charsPerToken = 4
    _determineContextSize(prompt, maxTokens, buffer=0.0) {
        // TODO: switch to a javacript version of TikToken from OpenAI
        // https://github.com/dqbd/tiktoken

        // do a simple character count for now. 
        const charsPerToken = 4;
        const promptLength = prompt.length;
        const responseLength = maxTokens*charsPerToken;
        const totalLength = (promptLength + responseLength);
        const legnthAllowed4K = 4000*charsPerToken;

        if (totalLength*(1 + buffer) < legnthAllowed4K) {
            return "4K";
        }

        return "16K";
    };

    // rotates between models within a context length
    // helps with rate-limiting since openAI calculations are per model based
    _rotateModelsId(contextSize="4K") {
        for (const model of this.defaultModels) {
            if(model.contextSize === contextSize) {
                const numModels = model.models.length;

                // don't need random generator if only one model
                if (numModels === 1) {
                    return model.models[0];
                }

                const index = this._getRandomInt(numModels);
                return model.models[index];
            }
        }

        return null;
    }

    // Returns 0 to max-1
    _getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    _createDefinition(schema) {

        let definitions = "";
        let exampleJson = {};
        let paramList = null;

        for (let key in schema ) {
            let { type, definition, example } = schema[key];

            // TODO: Add a pre-sentence based on the type. 
            // check type is correct
            if (type === null || type === undefined) {
                type = 'string';
            }

            if (paramList === null) {
                paramList = key + "";
            }
            else {
                paramList = paramList + ", " + key;
            }

            definitions = definitions + `
                ${key} - ${definition}
            `

            // TODO: if example is null, then check the type and put a default value
            exampleJson[key] = this._format(example);
        }

        return { paramList, stringified: definitions, example: exampleJson };
    }

    _format(string) {
        if (string != null) {
            return string.replace(/\s\s+/g, ' ').replace(/\n/g, ' ')
        }

        return null;
    }
}

module.exports = LLM;