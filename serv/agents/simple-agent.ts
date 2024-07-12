import _ from "lodash";
import { emptyPrompt, IAIModelDynamicPrompt } from "../models/base";
import { IAITool } from "../tools";
import { AIAgentContext, AIAgentSession, IAIAgent, IAIAgentResponse } from "./base";

export class SimpleAIAgent implements IAIAgent {
    protected systemPrompt = ''

    constructor(public name: string, public description: string, public shortDescription?: string) {
        this.shortDescription ??= this.description
    }

    get outputTags(): string[] {
        return []
    }

    async userPrompt(sess: AIAgentSession): Promise<IAIModelDynamicPrompt[]> {
        return []
    }

    async run(sess: AIAgentSession): Promise<IAIAgentResponse> {
        const prompts = await this.userPrompt(sess)
        if (!prompts) return emptyPrompt('model')

        const result = await sess.generate(...prompts)
        sess.addAgentRecord(result.outputPrompt, `output`, [result.id])
        return result.outputPrompt
    }
}