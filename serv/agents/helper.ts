import _ from "lodash";
import { IAIModel, IAIModelDynamicPrompt } from "../models/base";
import { IAITool } from "../tools";
import { AIAgentContext, IAIAgentRecord } from "./base";
import { SummaryAIAgent } from "./summary-agent";

export class AIAgentHelper {
    static async getRecordSummary(ctx: AIAgentContext, record: IAIAgentRecord) {
        if (!record.summary) {
            try {
                const summary = await SummaryAIAgent.INST.run(ctx)
                record.summary = _.first(summary.parts)?.text ?? 'Empty'
            }
            catch (err) {
                record.summary = 'No information. Cannot summarize'
            }
        }

        return record.summary
    }

    static splitLastRecord(history: IAIAgentRecord[]): [IAIAgentRecord[], IAIAgentRecord] {
        if (!history.length) throw new Error(`Cannot serve! No data found`)
        if (history.length === 1) return [[], history[0]]
        return [history.slice(0, history.length - 1), history[history.length - 1]]
    }

    static async buildSummaryPrompts(ctx: AIAgentContext, history: IAIAgentRecord[], ...exceptionTags: string[]) {
        await this.constructSummaries(ctx, history.filter(r => !r.tags.some(tag => exceptionTags.includes(tag))))
        return history.map(record => {
            if (record.tags.some(tag => exceptionTags.includes(tag))) return record.prompt
            return {
                role: record.prompt.role,
                parts: [{
                    text: [
                        ['ID', record.id],
                        ['Type', record.type],
                        ['From agent', record.agentName],
                        ['Summary', record.summary],
                    ].filter(([_, v]) => !!v).map(r => r.join(': ')).join('\n')
                }]
            }
        })
    }

    static async constructSummaries(ctx: AIAgentContext, records: IAIAgentRecord[]) {
        if (!records.length) return
        const chunks = _.chunk(records, 5)
        for (const chunk of chunks) {
            await Promise.all(chunk.map(r => this.getRecordSummary(ctx, r)))
        }
    }
}