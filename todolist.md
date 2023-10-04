
#### Automatically Parallelize a Prompt
TODO Example

#### TODO Items (smaller)
- [ ] Ability to set default temp, topP, maxT
- [ ] Ability to set temp, topP, maxT per prompt
- [ ] Ability to set default models
- [ ] Ability to set model per prompt
- [ ] Multiple requests with automatic majority answer (aka self-consistency)
- [ ] Have a 60s timeout

#### TODO Items (larger)
- [ ] Integrate Claude SDK
- [ ] Throw specific errors instead of failing open by default
- [ ] Integrate a tokenizer counter like TikToken

## Installation

This is a beta and built based on everything we learned taking our upcoming product to production, NetworkGPT.

This library is for people that don't need something as complex as LangChain, and would like to avoid vendor lock-in to OpenAI Functions.

```console
$ npm install simplellms
```