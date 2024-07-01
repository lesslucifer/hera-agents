import _ from "lodash";
import { AIAgentContext, IAIAgentInputPrompt, IAIAgentPromptPath, IAIAgentRecord } from "./base";
import { SummaryAIAgent } from "./summary-agent";

export class AIAgentHelper {
    static async getRecordSummary(ctx: AIAgentContext, record: IAIAgentRecord) {
        if (!record.summary) {
            try {
                const summary = await SummaryAIAgent.INST.run(ctx)
                record.summary.push(_.first(summary.parts)?.text ?? 'Empty')
            }
            catch (err) {
                record.summary.push('No information. Cannot summarize')
            }
        }

        return record.summary
    }

    static splitLastRecord(history: IAIAgentRecord[]): [IAIAgentRecord[], IAIAgentRecord] {
        if (!history.length) throw new Error(`Cannot serve! No data found`)
        if (history.length === 1) return [[], history[0]]
        return [history.slice(0, history.length - 1), history[history.length - 1]]
    }

    static async constructSummaries(ctx: AIAgentContext, records: IAIAgentRecord[]) {
        if (!records.length) return
        const chunks = _.chunk(records, 5)
        for (const chunk of chunks) {
            await Promise.all(chunk.map(r => this.getRecordSummary(ctx, r)))
        }
    }

    static isPromptPath(inputPrompt: IAIAgentInputPrompt): inputPrompt is IAIAgentPromptPath {
        return typeof inputPrompt === 'object' && 'recordId' in inputPrompt
    }

    static lastOutput(history: IAIAgentRecord[]) {
        return _.last(_.last(history)?.history)?.outputPrompt
    }
}