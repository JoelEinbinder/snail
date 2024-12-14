const { handler } = require('../host');
(async function() {
  const iterable = await handler.streamFromLLM({
    apiKey: process.env.SNAIL_OPENAI_KEY,
    model: 'gpt-4o',
    system: 'You are a weather reporter bot.',
    tools: [{
      "name": "get_weather_report",
      "description": "Fetches the weather report for a specific location.",
      "strict": true,
      "parameters": {
        "type": "object",
        "required": [
          "location",
          "date",
          "units"
        ],
        "properties": {
          "location": {
            "type": "string",
            "description": "The name of the location for the weather report."
          },
          "date": {
            "type": "string",
            "description": "The date for which the weather report is requested, in YYYY-MM-DD format."
          },
          "units": {
            "type": "string",
            "description": "The units for temperature measurement, either 'metric' for Celsius or 'imperial' for Fahrenheit.",
            "enum": [
              "metric",
              "imperial"
            ]
          }
        },
        "additionalProperties": false
      }
    }],
    messages: [
      { role: 'user', content: 'What is the weather like today in Boston? Also what is the weather in New York?' },
    ],
  });
  for await (const chunk of iterable) {
    console.log(chunk);
  }
  process.exit(0);
})();
