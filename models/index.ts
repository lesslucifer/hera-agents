import { Collection, Db } from "mongodb";
import { IConversation } from "./conversation";

export let Conversation: Collection<IConversation>

export async function initModels(db: Db) {
    Conversation = db.collection('conversation')
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