import { registerCompleter } from "../shellCompleter";

const models = [
  ['gpt-4o', 'Our most advanced, multimodal flagship model that\'s cheaper and faster than GPT-4 Turbo'],
  ['gpt-4-turbo', 'GPT-4 Turbo with Vision model. Vision requests can now use JSON mode and function calling.'],
  ['gpt-4', 'Snapshot of gpt-4 from June 13th 2023 with improved function calling support.'],
  ['gpt-4-32k', 'Snapshot of gpt-4-32k from June 13th 2023 with improved function calling support. This model was never rolled out widely in favor of GPT-4 Turbo'],
  ['gpt-3.5-turbo', 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats and a fix for a bug which caused a text encoding issue for non-English language function calls. Returns a maximum of 4,096 output tokens'],
]
registerCompleter('ai_model', async (shell, line, abortSignal) => {
  const anchor = 'ai_model '.length;
  if (!line.includes(' '))
    return null;
  return {
    anchor,
    suggestions: models.map(([text, value]) => ({text, description: async () => value}))
  };
});