/**
 * Manual AI evaluation runner — not part of CI.
 * Usage: AI_PROVIDER=ollama pnpm tsx e2e/ai-eval/run.ts
 */

const QUESTIONS = [
  'How much did we spend in total last month?',
  'What was our net income last month?',
  'Which category had the highest spending last month?',
];

async function main(): Promise<void> {
  const provider = process.env.AI_PROVIDER ?? 'ollama';
  await Promise.resolve();
  console.log(`AI eval scaffold (${provider}) — ${QUESTIONS.length} questions loaded.`);
  console.log('Implement provider calls and numeric scoring before marking phase 12 done.');
  for (const question of QUESTIONS) {
    console.log(`- ${question}`);
  }
}

void main();
