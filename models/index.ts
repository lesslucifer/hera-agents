import { Collection, Db } from "mongodb";
import { IChat, IChatMessage } from "./chat";
import { IAIAgent, IAIAgentQueryRecord, IAIOperationRecord } from "../serv/agents/base";

export let Chat: Collection<IChat>
export let ChatMessage: Collection<IChatMessage>
export let AgentQuery: Collection<IAIAgentQueryRecord>
export let OpRecord: Collection<IAIOperationRecord>

export async function initModels(db: Db) {
    Chat = db.collection('chat')
    ChatMessage = db.collection('messages')
    AgentQuery = db.collection('agent_query')
    OpRecord = db.collection('op_record')
    await migrate(db)
}

const MIGRATIONS = [];

async function migrate(db: Db) {
    const dbConfig = await db.collection('config').findOne({ type: 'db' });
    const dbVersion = (dbConfig && dbConfig.version) || 0;
    for (let i = dbVersion; i < MIGRATIONS.length; ++i) {
        try {
            await MIGRATIONS[i](db);
            await db.collection('config').updateOne({ type: 'db' }, { $set: { version: i + 1 } }, { upsert: true });
        }
        catch (err) {
            console.log(err)
        }
    }
}