import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt } from "../models/base";
import { AIAgentContext, AIAgentSession, IAIAgent, IAIAgentInputPrompt } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class ManagerAIAgent extends SimpleAIAgent {
    constructor(private agents: IAIAgent[]) {
        super(ManagerAIAgent.name,
            "The Manager AI Agent routes user messages to the most suitable specialized AI, ensuring efficient and accurate responses based on user intent and conversation history"
            , "Routes user messages to the best-suited specialized AI agent")

        this.systemInstruction = `You are the Manager AI Agent. Your job is to route user messages to the best-suited specialized AI agent. Follow these steps:

        1. Understand the user's message and intent.
        2. Review the conversation history for context.
        3. Select the best-suited AI agent.

        Your ouput MUST be in this JSON format:
        {
        "agent": "<only one agent name>",
        "feedback": "<further feedback for that agent to perform the work better if there is>"
        }`

        this.triggerPrompt = {
            role: 'user',
            parts: [
                { text: `This is the available agents:` },
                ...this.agents.map(agent => ({ text: `Agent Name: ${agent.name}; Description: ${agent.description}` })),
                { text: `Please help me select suitable agents to proceed` }
            ]
        }
    }

    get outputTags(): string[] {
        return ["agent_select", "feedback"]
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIModelPrompt> {
        const output = await super.run(inputs, ctx)
        const outputString = _.first(output.parts)?.text ?? ''
        const jsonMatch = outputString.slice(outputString.indexOf('{'), outputString.lastIndexOf('}') + 1)
        const jsonOutput = JSON.parse(jsonMatch)
        const { agent: agentName, feedback } = jsonOutput
        const agent = this.agents.find(ag => ag.name === agentName)
        if (!agent) throw new Error(`Agent Manager cannot find any suitable agent`)
        return await ctx.runAgent(agent, inputs, feedback || `continue to proceed`)
    }
}