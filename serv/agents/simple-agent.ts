import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt, IAIToolDeclaration } from "../models/base";
import { IAITool } from "../tools";
import { IAIAgent, AIAgentContext, IAIAgentResponse } from "./base";

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

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const prompts = await this.userPrompt(ctx)
        if (!prompts) return { role: 'model', parts: [] }

        const output = await ctx.execute(this, prompts, this.systemPrompt, this.tools)
        ctx.addAgentRecord(this, [{
            inputPrompts: prompts,
            outputPrompt: _.pick(output, 'role', 'parts'),
            usage: output.usage
        }])
        return output
    }
}