import { IAIModelDynamicPrompt, IAIModelPrompt, IAIToolDeclaration } from "../models/base";
import { IAITool } from "../tools";
import { IAIAgent, IAIAgentContext } from "./base";

export class SimpleAIAgent implements IAIAgent {
    constructor(public name: string, public description: string, public shortDescription?: string) {
        this.shortDescription ??= this.description
    }

    get tools(): IAITool[] {
        return []
    }

    async systemPrompt(ctx: IAIAgentContext): Promise<string> {
        return ''
    }

    async userPrompt(ctx: IAIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        return []
    }

    async run(ctx: IAIAgentContext) {
        const prompts = await this.userPrompt(ctx)
        return this.runWithPrompts(ctx, prompts)
    }

    async runWithPrompts(ctx: IAIAgentContext, prompts: IAIModelDynamicPrompt[]) {
        return await ctx.model.generate({
            prompts,
            sysInstruction: await this.systemPrompt(ctx),
            tools: this.tools
        })
    }
}