import { ApiError } from '../../utils/ApiError';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface SolveResult {
  explanation: string;
  answer: string;
  relatedConcepts: string[];
  steps: string[];
}
export interface AIResult<T> { result: T; model: string }

export interface AIProvider {
  readonly name: string;
  generateResponse(messages: ChatMessage[]): Promise<AIResult<string>>;
  solveQuestion(question: string, opts: { hasImage: boolean }): Promise<AIResult<SolveResult>>;
  generateExplanation(topic: string, level?: string): Promise<AIResult<string>>;
  generateStudyPlan(input: { subject: string; goal: string; days: number }): Promise<AIResult<string[]>>;
}

const notConfigured = (name: string): never => {
  throw new ApiError(501, 'AI_NOT_CONFIGURED', `AI provider "${name}" is not configured`);
};

/** Real providers plug in here (via fetch) once keys/SDKs are available. */
abstract class UnconfiguredProvider implements AIProvider {
  abstract readonly name: string;
  protected abstract keyPresent(): boolean;
  private guard(): never {
    return notConfigured(this.name);
  }
  async generateResponse(): Promise<AIResult<string>> { return this.guard(); }
  async solveQuestion(): Promise<AIResult<SolveResult>> { return this.guard(); }
  async generateExplanation(): Promise<AIResult<string>> { return this.guard(); }
  async generateStudyPlan(): Promise<AIResult<string[]>> { return this.guard(); }
}

export class OpenAIProvider extends UnconfiguredProvider {
  readonly name = 'openai';
  protected keyPresent() { return !!process.env.OPENAI_API_KEY; }
}
export class GeminiProvider extends UnconfiguredProvider {
  readonly name = 'gemini';
  protected keyPresent() { return !!process.env.GEMINI_API_KEY; }
}
export class ClaudeProvider extends UnconfiguredProvider {
  readonly name = 'claude';
  protected keyPresent() { return !!process.env.ANTHROPIC_API_KEY; }
}

const MODEL = 'mock-edu-1';
const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}...` : s);

export class MockProvider implements AIProvider {
  readonly name = 'mock';

  async generateResponse(messages: ChatMessage[]) {
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const text =
      `Great question! Here is a way to think about "${clip(last)}":\n\n` +
      '1. Start by writing down what you already know.\n' +
      '2. Break the problem into smaller parts.\n' +
      '3. Try a simple example before generalising.\n\n' +
      'Want me to walk through an example or make a short practice quiz?';
    return { result: text, model: MODEL };
  }

  async solveQuestion(question: string, opts: { hasImage: boolean }) {
    const q = clip(question, 120);
    return {
      model: MODEL,
      result: {
        explanation: `${opts.hasImage ? 'Using your attached image and text, ' : ''}the question "${q}" can be solved by identifying the given information, choosing the relevant rule, and applying it step by step.`,
        answer: 'See the final step below (sample answer from the offline mock provider).',
        relatedConcepts: ['Problem decomposition', 'Units and estimation', 'Checking your answer'],
        steps: [
          'Read the question carefully and list the known values.',
          'Decide which formula or concept applies.',
          'Substitute the values and simplify.',
          'Verify the result makes sense.',
        ],
      },
    };
  }

  async generateExplanation(topic: string, level = 'beginner') {
    return {
      model: MODEL,
      result: `${clip(topic, 100)} explained at a ${level} level: begin with the core idea, then look at an everyday example, and finish with a short summary.`,
    };
  }

  async generateStudyPlan({ subject, goal, days }: { subject: string; goal: string; days: number }) {
    const n = Math.min(Math.max(days, 1), 30);
    return {
      model: MODEL,
      result: Array.from({ length: n }, (_, i) =>
        i === n - 1
          ? `Day ${i + 1}: Full ${subject} revision and self-test toward "${clip(goal, 60)}".`
          : `Day ${i + 1}: ${subject} topic ${i + 1} (30 min reading, 20 min practice).`,
      ),
    };
  }
}
