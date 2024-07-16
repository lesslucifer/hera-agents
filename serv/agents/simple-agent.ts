import _ from "lodash";
import { emptyPrompt, IAIModelDynamicPrompt } from "../models/base";
import { IAITool } from "../tools";
import { AIAgentSession, AIAgentContext, IAIAgent, IAIAgentResponse, IAIAgentInputPrompt } from "./base";

export class SimpleAIAgent implements IAIAgent {
    public systemInstruction = ''
    protected triggerPrompt: IAIAgentInputPrompt

    constructor(public name: string, public description: string, public shortDescription?: string) {
        this.shortDescription ??= this.description
    }

    get outputTags(): string[] {
        return []
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        if (!inputs) return emptyPrompt('model')

        const prompts = [...inputs]
        if (this.triggerPrompt) {
            prompts.push(this.triggerPrompt)
        }
        const result = await ctx.query(prompts)
        await ctx.addOpRecord(result.outputPrompt, `output`, [result.id])
        return result.outputPrompt
    }
}