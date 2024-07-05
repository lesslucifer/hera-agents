import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { AIAgentHelper } from "./helper";

export class NaturalResponseAgent extends SimpleAIAgent {
    constructor() {
        super(
            NaturalResponseAgent.name,
            "An AI agent that reviews the last output of other agents and rewrites the final answer to the user query in a natural way, considering the context of the whole conversation",
            "Enhances AI responses for natural human-like communication"
        );

        this.systemPrompt = `You are an AI agent specialized in reviewing and enhancing the final outputs of other AI agents. Your primary functions are:

        1. Analyze the entire conversation history to understand the full context.
        2. Review the last output from the previous agent.
        3. Rewrite the final answer in a more natural, conversational tone while maintaining accuracy and relevance.
        4. Ensure the response addresses the user's original query comprehensively.
        5. Add any necessary context or clarifications based on the conversation history.
        6. Maintain a consistent tone and style throughout the response.

        Your goal is to make the AI's responses feel more human-like and engaging while preserving the informational content and accuracy of the original output.`;
    }

    get outputTags(): string[] {
        return ["answer"]
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        return [
            ...ctx.conversationPrompts,
            {
                role: 'user',
                parts: [
                    { text: "\n\nPlease rewrite this response in a more natural, conversational way, ensuring it addresses the user's original query and maintains the accuracy of the information. Consider the entire conversation context in your reformulation." }
                ]
            }
        ];
    }
}