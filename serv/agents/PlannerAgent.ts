import { IAIModelDynamicPrompt, IAIModelPrompt } from "../models/base";
import { IAITool } from "../tools";
import { AIAgentContext } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class PlannerAgent extends SimpleAIAgent {
    constructor(public _tools: IAITool[]) {
        super(
            PlannerAgent.name,
            "An AI agent specialized in creating detailed, actionable plans based on user queries, available tools, and conversation history",
            "Creates optimized plans for execution by other AI agents"
        );

        this.systemPrompt = `You are a Planner AI Agent, an expert in creating detailed and actionable plans that can be processed by an Execution AI. Your role is to carefully analyze user queries, available tools, and conversation history to construct comprehensive plans. Follow these guidelines:
        1. Thoroughly analyze the user's query and intent.
        2. Review the conversation history for context and previous actions or feedback.
        3. Consider the available tools and their capabilities.
        4. Use your knowledge to fill in gaps where necessary.
        5. Create a step-by-step plan that leads to fulfilling the user's query.
        6. Ensure each step is actionable and based on facts from tools or conversation history.
        7. Express the plan in plain text, avoiding any code or scripts.
        8. Include steps for gathering necessary information if it's not readily available.
        9. Optimize the plan based on any feedback or actions from previous interactions.

        Your output should be a clear, detailed plan that an Execution AI can follow to achieve the user's goal.`;
            }

    get tools() {
        return this._tools
    }

    get outputTags(): string[] {
        return ["plan"]
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        const toolDescriptions = this.tools.map(tool => 
            `Tool Name: ${tool.name}; Description: ${tool.description}`
        ).join('\n');

        return [
            ...ctx.conversationPrompts,
            {
                role: 'user',
                parts: [
                    { text: `Create a detailed plan to address the user query` },
                    { text: "Available tools:\n" + toolDescriptions },
                    { text: "Remember to create a plan that leads to the final answer, using available tools and information from the conversation history. The plan should be in plain text and actionable by an Execution AI." }
                ]
            }
        ];
    }

    async run(ctx: AIAgentContext): Promise<IAIModelPrompt> {
        return await super.run(ctx);
    }
}