## SimpleLLMs.js
An opinionated library to quickly integrate any reasonable LLM into your production app.

Turns your LLM into a reliable JSON returning machine! 
(Will soon integrate with a few LLAMA endpoints)

## Quick start
```js
const LLMs = require('simple-llms');

// recommended to only initialize once in app
const apiKey = { key: "XYZ", provider: "openai" };
const llms = new LLMs(apiKey);

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
}

// Now let's try to find some countries
const input = "Originally born in New Jersey and lived in Bangalore. Later I went to university in Vancouver (Canada)."

// Ready, set, go!
const prompt = llms.createPrompt(task, schema, input, opts);
const result = await llms.run(prompt);

console.log(result); // { response: { countries: [ 'CAN', 'IND', 'USA' ] }, analytics: Object }
```

## Installation

This is a beta and built based on everything we learned taking our upcoming product to production, NetworkGPT.

This library is for people that don't need something as complex as LangChain, and would like to avoid vendor lock-in to OpenAI Functions.

```console
$ npm install simple-llms
```

## Features
- [X] Have a prompt format that works out of the box to send and receive JSON.
- [X] Rotates between multiple endpoints and models. 
  - This helps with rate limiting and brownout protection if one particular endpoint goes down.
- [X] Switches from a 4K to 16K context size model when needed
- [X] Parses json with a wrapper around dirty-json. TODO: link.
- [X] Easy parallelization that helps in real-time app useage for sub 5-sec latency
- [X] Basic Unit Tests
- [X] Automatic retry when JSON can't be parsed
- [X] Analytics - latency of request, tokens used, model used

### TODO (Roadmap)
- [ ] Multiple requests with automatic majority answer selection and ability to define your own resolution function (avg, for booleans OR / AND)
- [ ] Integrate with Claude (Anthropic) SDK
- [ ] Integrate with an HTTP based endpoint as an example (TextSynth, OpenRouter, etc ...)
- [ ] Support for few-shot learning
- [ ] Support for chain of thought reasioning
- [ ] Integrate a tokenizer counter like TikToken (Current counts chars and makes an estimate to determine context size)
- [ ] Throw specific errors instead of failing open by default
- [ ] Ability to set temperature, tokens, maxP
- [ ] Automatic retry when server hits a timeout 
  - We recently discovered the TP 99.99 for OpenAI for example jumps from ~10 seconds to 600 seconds.
- [ ] Support for streaming

To keep this library simple, it is not recommended for users that want to have memory, streaming, or to train / fine-tune. Note: Streaming will be supported in the future.

Currently integrates with the Azure OpenAI library that works with both Azure OpenAI and OpenAI


## Philosophy
This library is built based on everything we learned for taking our upcoming product to production, NetworkGPT. 

The goal of this library is to be able to quickly and reliably take prompts to production. At it's core this library is meant to be simple and to help developers integrate their LLMs into their production application without vendor lock-in.

## Examples
#### Initialize Azure Model

```js
// Send follow params to initialize LLM with Azure
const azureLLM = new LLMs({ 
    key: azureKey, 
    provider : 'azure', 
    endpoint: azureEndpoint
});
```

#### Automatically Send Multiple Prompts
```js

// Copy task and schema from Quickstart above

// Now let's try to find some countries
const inputOne = "Originally born in New Jersey and also lived in Bangalore. Later I went to university in Vancouver (Canada).";
const inputTwo = "Lived in both Buenos Aires and Sao Paulo";

// Ready, set, go!
const promptOne = llms.createPrompt(task, schema, inputOne);
const promptTwo = llms.createPrompt(task, schema, inputTwo);

// you can pass in an array of prompts to runMany
// by default will run in 'serial' mode if 'parallel' flag not provided
const [ resultOne, resultTwo ] = await llms.runMany([promptOne, promptTwo], 'parallel');
```

#### Automatically Parallelize a Prompt
TODO Example

#### TODO Items (smaller)
- [ ] Ability to set default temp, topP, maxT
- [ ] Ability to set temp, topP, maxT per prompt
- [ ] Ability to set default models
- [ ]Ability to set model per prompt
- [ ] Multiple requests with automatic majority answer (aka self-consistency)
- [ ]Have a 60s timeout

#### TODO Items (larger)
- [ ] Integrate Claude SDK
- [ ] Throw specific errors instead of failing open by default
- [ ] Integrate a tokenizer counter like TikToken

## License

  [MIT](LICENSE)
