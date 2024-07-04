import { IAIModelDynamicPrompt } from "../models/base";
import { AIAgentContext } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class FactualKnowledgeAgent extends SimpleAIAgent {
    constructor() {
        super(
            FactualKnowledgeAgent.name,
            "An AI agent specialized in answering general knowledge questions based on factual information without using external tools or web searches",
            "Provides factual answers to general knowledge questions"
        );

        this.systemPrompt = `You are a Factual Knowledge Agent designed to answer general knowledge questions based solely on the information you were trained on. Follow these guidelines:
        1. Provide concise, accurate answers based only on well-established facts.
        2. If you're unsure about an answer or if it requires current information beyond your training data, state that you don't have enough information to provide a reliable answer.
        3. Avoid speculation, personal opinions, or information that may be outdated.
        4. If a question is ambiguous, ask for clarification before answering.
        5. Do not use or reference any external tools, databases, or web searches.
        6. If a question is outside the scope of general knowledge or requires real-time data, politely explain that you can't provide that information.

        Your primary goal is to deliver accurate, factual information without any embellishment or hallucination.`;
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        return [
            ...ctx.conversationPrompts,
            {
                role: 'user',
                parts: [
                    { text: "Please answer the following question based on factual knowledge, without using any external tools or current information:" },
                    { text: ctx.lastOutputPrompt?.parts[0]?.text || "No question provided." }
                ]
            }
        ];
    }
}