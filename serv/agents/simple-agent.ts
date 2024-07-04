import _ from "lodash";
import { IAIModelDynamicPrompt } from "../models/base";
import { IAITool } from "../tools";
import { AIAgentContext, IAIAgent, IAIAgentResponse } from "./base";

export class SimpleAIAgent implements IAIAgent {
    protected systemPrompt = ''

    constructor(public name: string, public description: string, public shortDescription?: string) {
        this.shortDescription ??= this.description
    }

    get tools(): IAITool[] {
        return []
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        return []
    }

    async run(ctx: AIAgentContext, request?: IAIModelDynamicPrompt): Promise<IAIAgentResponse> {
        const prompts = await this.userPrompt(ctx)
        if (!prompts) return { role: 'model', parts: [] }

        if (request) {
            prompts.push(request)
        }

        const output = await ctx.execute(prompts, this.systemPrompt, this.tools)
        ctx.addAgentRecord(this.name, prompts, output.prompt, output.usage)
        return output.prompt
    }
}