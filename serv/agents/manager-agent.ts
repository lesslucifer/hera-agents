import { IAIModelDynamicPrompt, IAIModelPrompt } from "../models/base";
import { AIAgentContext, IAIAgent } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class ManagerAIAgent extends SimpleAIAgent {
    constructor(private agents: IAIAgent[]) {
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
        if (!this.agents.length) throw new Error(`Manager agent cannot proceed. No agent configured`)
        return [
            ...ctx.conversationPrompts,
            [
                `This is the available agents:`,
                ...this.agents.map(agent => `Agent Name: ${agent.name}; Description: ${agent.description}`)
            ].join('\n')
        ]
    }

    async run(ctx: AIAgentContext): Promise<IAIModelPrompt> {
        const output = await super.run(ctx)
        const jsonOutput = JSON.parse(output.parts[0].text)
        const { agent: agentName } = jsonOutput
        const agent = this.agents.find(ag => ag.name === agentName)
        if (!agent) throw new Error(`Agent Manager cannot find any suitable agent`)
        return await agent.run(ctx)
    }
}