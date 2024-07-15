import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/qdrant-js";
import { IAITool } from ".";
import ENV from "../../glob/env";
import { IAIModelPrompt } from "../models/base";

export class GetTicketByDescription implements IAITool {
    qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });
    _embeddingModel: GenerativeModel

    get embeddingModel() {
        return this._embeddingModel ?? (
            this._embeddingModel = new GoogleGenerativeAI(ENV.GEMINI_KEY).getGenerativeModel({
                model: "text-embedding-004"
            }, { apiVersion: "v1beta" })
        )
    }

    readonly name: string = GetTicketByDescription.name;
    readonly description = "Getting the key of issues / ticket having similar description to the provided content within a project"
    readonly parameters = {
        "type": "OBJECT",
        "properties": {
            "content": {
                "type": "STRING",
                "description": "The content of query, it should have semantic information, should not contains key or id"
            },
            "project": {
                "type": "STRING",
                "description": "The key of the project"
            }
        },
        "required": ["content", "project"]
    }

    async apply({ content, project }: { content: string, project: string }) {
        const { embedding } = await this.embeddingModel.embedContent(content)

        const results = await this.qdrant.search(project, {
            vector: embedding.values,
            limit: 10
        })

        return {
            issueKeys: results.map(r => r.payload.key)
        }
    }

}