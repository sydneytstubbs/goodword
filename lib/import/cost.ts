// What an import's AI call cost (PRD F15.4, 11.2). Claude Haiku 4.5 is $1 per
// million input tokens and $5 per million output tokens: 1 and 5 microdollars
// a token.
const MICRODOLLARS_IN = 1;
const MICRODOLLARS_OUT = 5;

export function costMicrodollars(inputTokens: number, outputTokens: number): number {
  return inputTokens * MICRODOLLARS_IN + outputTokens * MICRODOLLARS_OUT;
}
