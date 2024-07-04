import * as YAML from 'json-to-pretty-yaml';
import { emptyAIModelUsage } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class ChainingAIAgent extends SimpleAIAgent {
    private agents: IAIAgent[];
    private fallbackAgent: IAIAgent;

    constructor(agents: IAIAgent[], fallbackAgent: IAIAgent) {
        super(
            ChainingAIAgent.name,
            "An AI agent that chains multiple agents together, passing the output of one agent as input to the next, with a fallback mechanism for error handling",
            "Chains multiple AI agents for complex task processing"
        );

        this.agents = agents;
        this.fallbackAgent = fallbackAgent;
        this.systemPrompt = ``;
    }

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        let lastAgent: IAIAgent = null
        try {
            for (const agent of this.agents) {
                lastAgent = agent
                await agent.run(ctx)
            }
        } catch (error) {
            return this.handleError(ctx, error, lastAgent);
        }
    }

    private async handleError(ctx: AIAgentContext, error: any, lastAgent: IAIAgent): Promise<IAIAgentResponse> {
        ctx.addAgentRecord(this.name, ["error"], [], {
            role: 'model',
            parts: [
                { text: `An error occured during the process agent named ${lastAgent?.name}. Please handle this situation and provide guidance. Error details: ${YAML.stringify(error)}` },
            ]
        }, emptyAIModelUsage())

        return await this.fallbackAgent.run(ctx);
    }
}