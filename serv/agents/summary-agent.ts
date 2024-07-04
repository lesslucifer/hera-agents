import _, { last } from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt } from "../models/base";
import { AIAgentContext } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { AIAgentHelper } from "./helper";

export class SummaryAIAgent extends SimpleAIAgent {
    static readonly INST = new SummaryAIAgent()

    constructor() {
        super(SummaryAIAgent.name,
            "An AI agent that summarizes outputs from other agents, function calls, and user data, providing concise, structured insights to support decision-making processes in multi-agent systems"
            , "Support agent summarizing diverse inputs for AI system optimization")

        this.systemPrompt = `You are an AI agent specialized in summarizing data to support other AI agents. Your primary function is to analyze and condense outputs from various sources, including other agents, function calls, function responses, and user-provided data. When presented with information to summarize, follow these steps:
        Identify the source and type of the input (e.g., agent output, function call, user data).
        Determine the key elements and most relevant information within the input.
        Analyze for patterns, inconsistencies, or notable points across multiple inputs if applicable.
        Synthesize your analysis into a structured summary, including:
        a) An overview of the input source(s)
        b) Key points or findings
        c) Relevant details or data points
        d) Potential implications for the requesting agent or system

        Your summaries should be concise, clear, and tailored to assist other AI agents or systems in their decision-making processes. Adapt your output format to best serve the needs of the requesting agent or function.`
    }

    get outputTags(): string[] {
        return ["summary"]
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        if (!ctx.history.length) return []

        return [
            ...ctx.conversationPrompts,
            {
                role: 'user',
                parts: [
                    { text: `Summarize the given conversation` },
                ]
            }
        ]
    }
}