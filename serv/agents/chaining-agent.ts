import * as YAML from 'json-to-pretty-yaml';
import _ from 'lodash';
import { emptyPrompt, IAIModelPrompt, mkPrompt } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentInputPrompt, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class ChainingAIAgent extends SimpleAIAgent {
    private agents: IAIAgent[];
    private fallbackAgent: IAIAgent;

    constructor(agents: IAIAgent[], fallbackAgent: IAIAgent, private nRetainedInputs = 1) {
        super(
            ChainingAIAgent.name,
            "An AI agent that chains multiple agents together, passing the output of one agent as input to the next, with a fallback mechanism for error handling",
            "Chains multiple AI agents for complex task processing"
        );

        this.agents = agents;
        this.fallbackAgent = fallbackAgent;
        this.systemInstruction = ``;
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        let lastAgent: IAIAgent = null
        let outputs: IAIModelPrompt[] = inputs.map(p => mkPrompt(p))
        try {
            for (const agent of this.agents) {
                lastAgent = agent
                const output = await ctx.runAgent(agent, _.takeRight(outputs, this.nRetainedInputs))
                outputs.push(output)
            }
        } catch (error) {
            return this.handleError(ctx, error, outputs, lastAgent);
        }

        return _.last(outputs)
    }

    private async handleError(ctx: AIAgentContext, err: any, outputs: IAIModelPrompt[], lastAgent: IAIAgent): Promise<IAIAgentResponse> {
        ctx.addOpRecord(emptyPrompt('model'),
            `An error occured during the process agent named ${lastAgent?.name}. Please handle this situation and provide guidance. Error details: ${YAML.stringify(err)}`)

        return await ctx.runAgent(this.fallbackAgent, [{
            role: 'model',
            parts: [
                { text: 'An error occured' },
                { text: `Error description: ${err?.message}\n\n${err?.stack}\n\n${YAML.stringify(err)}` }
            ]
        }], `An error occured. As a fallback agent, please handle it`)
    }
}