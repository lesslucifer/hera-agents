import { IAIModelDynamicPrompt, IAIModelPrompt, IAIToolDeclaration } from "../models/base";
import { IAITool } from "../tools";
import { IAIAgent, AIAgentContext } from "./base";

export class SimpleAIAgent implements IAIAgent {
    protected _systemPrompt = ''

    constructor(public name: string, public description: string, public shortDescription?: string) {
        this.shortDescription ??= this.description
    }

    get tools(): IAITool[] {
        return []
    }

    async systemPrompt(ctx: AIAgentContext): Promise<string> {
        return this._systemPrompt
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        return []
    }

    async run(ctx: AIAgentContext) {
        const prompts = await this.userPrompt(ctx)
        return this.runWithPrompts(ctx, prompts)
    }

    async runWithPrompts(ctx: AIAgentContext, prompts: IAIModelDynamicPrompt[]) {
        return await ctx.model.generate({
            prompts,
            sysInstruction: await this.systemPrompt(ctx),
            tools: this.tools
        })
    }
}