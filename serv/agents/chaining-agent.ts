import * as YAML from 'json-to-pretty-yaml';
import { emptyAIModelUsage, emptyPrompt } from "../models/base";
import { AIAgentContext, AIAgentSession, IAIAgent, IAIAgentResponse } from "./base";
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

    async run(sess: AIAgentSession): Promise<IAIAgentResponse> {
        let lastAgent: IAIAgent = null
        try {
            for (const agent of this.agents) {
                lastAgent = agent
                sess.runAgent(agent)
            }
        } catch (error) {
            return this.handleError(sess, error, lastAgent);
        }
    }

    private async handleError(sess: AIAgentSession, error: any, lastAgent: IAIAgent): Promise<IAIAgentResponse> {
        sess.addAgentRecord(emptyPrompt('model'),
            `An error occured during the process agent named ${lastAgent?.name}. Please handle this situation and provide guidance. Error details: ${YAML.stringify(error)}`)

        return await sess.runAgent(this.fallbackAgent, `An error occured. As a fallback agent, please handle it`)
    }
}