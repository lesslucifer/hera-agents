import _ from "lodash";
import { AIAgentContext, IAIAgentInputPrompt, IAIAgentRecord } from "./base";
import { SummaryAIAgent } from "./summary-agent";
import { IAIModelUsage } from "../models/base";

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

    static async constructSummaries(ctx: AIAgentContext, records: IAIAgentRecord[]) {
        if (!records.length) return
        const chunks = _.chunk(records, 5)
        for (const chunk of chunks) {
            await Promise.all(chunk.map(r => this.getRecordSummary(ctx, r)))
        }
    }

    static accumulateUsage(target: IAIModelUsage, ...incs: IAIModelUsage[]) {
        for (const inc of incs) {
            target.inputToken += inc.inputToken
            target.outputToken += inc.outputToken
            target.totalToken += inc.totalToken
        }
        return target
    }
}