import _ from "lodash";
import { AIAgentSession, IAIAgentInputPrompt, IAIOperationRecord } from "./base";
import { SummaryAIAgent } from "./summary-agent";
import { IAIModel, IAIModelPrompt, IAIModelPromptPart, IAIModelUsage } from "../models/base";

type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
type JsonArray = JsonValue[];
type JsonObject = object // { [key: string]: JsonValue };

export class AIAgentHelper {
    // static async getRecordSummary(ctx: AIAgentSession, record: IAIOperationRecord) {
    //     if (!record.summary) {
    //         try {
    //             const summary = await SummaryAIAgent.INST.run(ctx)
    //             record.summary = _.first(summary.parts)?.text ?? 'Empty'
    //         }
    //         catch (err) {
    //             record.summary = 'No information. Cannot summarize'
    //         }
    //     }

    //     return record.summary
    // }

    static splitLastRecord(history: IAIOperationRecord[]): [IAIOperationRecord[], IAIOperationRecord] {
        if (!history.length) throw new Error(`Cannot serve! No data found`)
        if (history.length === 1) return [[], history[0]]
        return [history.slice(0, history.length - 1), history[history.length - 1]]
    }

    // static async constructSummaries(ctx: AIAgentSession, records: IAIOperationRecord[]) {
    //     if (!records.length) return
    //     const chunks = _.chunk(records, 5)
    //     for (const chunk of chunks) {
    //         await Promise.all(chunk.map(r => this.getRecordSummary(ctx, r)))
    //     }
    // }

    static accumulateUsage(target: IAIModelUsage, ...incs: IAIModelUsage[]) {
        for (const inc of incs) {
            target.inputToken += inc.inputToken
            target.outputToken += inc.outputToken
            target.totalToken += inc.totalToken
        }
        return target
    }

    static extendPrompt(prompt: IAIModelPrompt, parts: (string | IAIModelPromptPart)[], head = true) {
        const toParts: IAIModelPromptPart[] = parts.map(p => typeof p === 'string' ? { text: p } : p)
        return {
            role: prompt.role,
            parts: [
                ...(head ? toParts : []),
                ...prompt.parts,
                ...(!head ? toParts : [])
            ]
        }
    }

    static sortKeys(obj: JsonValue): JsonValue {
        if (_.isArray(obj)) {
          return obj.map(this.sortKeys.bind(this));
        } else if (_.isPlainObject(obj)) {
          return Object.keys(obj).sort().reduce<JsonObject>((result, key) => {
            result[key] = this.sortKeys(obj[key]);
            return result;
          }, {});
        } else {
          return obj;
        }
      }
      
      static stableStringify(item: JsonValue): string {
        return JSON.stringify(this.sortKeys(item));
      }
      
      static uniqJsonDeep<T extends JsonValue>(jsonList: T[]): T[] {
        const seen = new Set<string | T>();
        const result: T[] = [];
      
        for (const item of jsonList) {
          let key: string;
          if (_.isObject(item)) {
            key = this.stableStringify(item);
          } else {
            key = JSON.stringify(item);
          }
      
          if (!seen.has(key)) {
            seen.add(key)
            result.push(item)
          }
        }
      
        return result;
      }
      
}