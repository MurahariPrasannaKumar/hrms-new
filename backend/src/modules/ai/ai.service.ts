import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import {
  ClaudeProvider, GeminiProvider, MockProvider, OpenAIProvider,
  type AIProvider, type AIResult, type ChatMessage,
} from './ai.provider';

let provider: AIProvider | undefined;
export const getAIProvider = (): AIProvider => {
  if (provider) return provider;
  switch (env.AI_PROVIDER) {
    case 'mock': provider = new MockProvider(); break;
    case 'openai': provider = new OpenAIProvider(); break;
    case 'gemini': provider = new GeminiProvider(); break;
    case 'claude': provider = new ClaudeProvider(); break;
    default: throw new ApiError(500, 'AI_MISCONFIGURED', `Unknown AI_PROVIDER "${env.AI_PROVIDER}"`);
  }
  return provider;
};

/** Logs metadata only (never prompt text) for every AI call. */
const tracked = async <T>(u: AuthUser, module: string, category: string, fn: (p: AIProvider) => Promise<AIResult<T>>): Promise<T> => {
  const p = getAIProvider();
  const started = Date.now();
  let model: string | undefined;
  let success = false;
  try {
    const out = await fn(p);
    model = out.model;
    success = true;
    return out.result;
  } finally {
    prisma.aIRequestLog
      .create({
        data: { userId: u.id, schoolId: u.schoolId, module, category, provider: p.name, model, latencyMs: Date.now() - started, success },
      })
      .catch((err) => logger.error({ err }, 'Failed to write AI request log'));
  }
};

export const aiService = {
  generateResponse: (u: AuthUser, module: string, messages: ChatMessage[]) =>
    tracked(u, module, 'chat', (p) => p.generateResponse(messages)),
  solveQuestion: (u: AuthUser, question: string, hasImage: boolean) =>
    tracked(u, 'instasolve', 'solve', (p) => p.solveQuestion(question, { hasImage })),
  generateExplanation: (u: AuthUser, topic: string, level?: string) =>
    tracked(u, 'v-buddy', 'explain', (p) => p.generateExplanation(topic, level)),
  generateStudyPlan: (u: AuthUser, input: { subject: string; goal: string; days: number }) =>
    tracked(u, 'v-buddy', 'study-plan', (p) => p.generateStudyPlan(input)),
};

const HISTORY_LIMIT = 20;

export const vBuddyService = {
  suggestions: () => [
    'Explain photosynthesis in simple words',
    'Help me make a study plan for my maths exam',
    'What is the difference between speed and velocity?',
    'Quiz me on fractions',
  ],

  async chat(u: AuthUser, input: { conversationId?: string; message: string }) {
    let conversation = input.conversationId
      ? await prisma.aIConversation.findFirst({ where: { id: input.conversationId, userId: u.id } })
      : null;
    if (input.conversationId && !conversation) throw ApiError.notFound('Conversation not found');
    conversation ??= await prisma.aIConversation.create({
      data: { userId: u.id, schoolId: u.schoolId, title: input.message.slice(0, 60) },
    });

    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: input.message } });
    const history = (
      await prisma.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: HISTORY_LIMIT })
    ).reverse();
    const reply = await aiService.generateResponse(u, 'v-buddy', history.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })));
    const message = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: reply } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return { conversationId: conversation.id, title: conversation.title, message };
  },

  listConversations: (u: AuthUser, skip: number, take: number) =>
    prisma.$transaction([
      prisma.aIConversation.findMany({ where: { userId: u.id }, orderBy: { updatedAt: 'desc' }, skip, take }),
      prisma.aIConversation.count({ where: { userId: u.id } }),
    ]),

  async getConversation(u: AuthUser, id: string) {
    const c = await prisma.aIConversation.findFirst({
      where: { id, userId: u.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw ApiError.notFound('Conversation not found');
    return c;
  },

  async deleteConversation(u: AuthUser, id: string) {
    const { count } = await prisma.aIConversation.deleteMany({ where: { id, userId: u.id } });
    if (!count) throw ApiError.notFound('Conversation not found');
  },
};

export const instasolveService = {
  async solve(u: AuthUser, input: { question: string; fileId?: string }) {
    if (input.fileId) {
      const file = await prisma.file.findFirst({ where: { id: input.fileId, uploadedById: u.id } });
      if (!file || !file.mimeType.startsWith('image/')) throw ApiError.badRequest('fileId must reference an image you uploaded');
    }
    return aiService.solveQuestion(u, input.question, !!input.fileId);
  },
};
