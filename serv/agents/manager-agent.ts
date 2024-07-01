import _ from "lodash";
import { IAIModelDynamicPrompt } from "../models/base";
import { AIAgentContext } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { AIAgentHelper } from "./helper";

export class ManagerAIAgent extends SimpleAIAgent {
    static readonly ISNT = new ManagerAIAgent()

    constructor() {
        super(ManagerAIAgent.name,
            "The Manager AI Agent routes user messages to the most suitable specialized AI, ensuring efficient and accurate responses based on user intent and conversation history"
            , "Routes user messages to the best-suited specialized AI agent")

        this.systemPrompt = `You are the Manager AI Agent. Your job is to route user messages to the best-suited specialized AI agent. Follow these steps:

        1. Understand the user's message and intent.
        2. Review the conversation history for context.
        3. Select the best-suited AI agent.

        Your ouput must be in this JSON format:
        {
        "agent": "<only one agent name>",
        "feedback": "<further feedback for that agent to perform the work better if there is>"
        }`
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        const lastRecord = AIAgentHelper.lastOutput(ctx.history)

        if (lastRecord.role === 'user') {
            return ctx.conversationPrompts
        }

        return [
            ...ctx.conversationPrompts,
            'Proceed to continue according to the given conversation'
        ]
    }
}