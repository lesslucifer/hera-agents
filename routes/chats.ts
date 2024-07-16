import { Body, ExpressRouter, GET, POST, Params, Query } from "express-router-ts";
import { ObjectId } from "mongodb";
import { Chat, ChatMessage } from "../models";
import { Agent } from "../serv/agent";
import { IChat, IChatMessage } from "../models/chat";
import { nanoid } from "nanoid";
import { emptyAIModelUsage } from "../serv/models/base";

interface ChatWithLastMessage extends IChat {
    lastMessage?: IChatMessage;
}

class ChatRouter extends ExpressRouter {
    @POST({ path: "/" })
    async createANewChat(@Body('q') q: string): Promise<IChat> {
        const newChat: IChat = {
            id: nanoid(),
            totalUsage: emptyAIModelUsage()
        };

        await Chat.insertOne(newChat);

        if (!q) {
            throw new Error("Query is required to create a new chat");
        }

        await Agent.ask(newChat.id, q);
        return newChat;
    }

    @GET({ path: "/" })
    async listChats(
        @Query('limit') limit: number = 20,
        @Query('offset') offset: number = 0
    ): Promise<ChatWithLastMessage[]> {
        const chats = await Chat.find()
            .sort({ _id: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        const chatsWithLastMessage: ChatWithLastMessage[] = await Promise.all(
            chats.map(async (chat) => {
                const lastMessage = await this.getLastMessageForChat(chat.id);
                return { ...chat, lastMessage };
            })
        );

        return chatsWithLastMessage;
    }

    @GET({ path: "/:chatId/messages" })
    async getChatMessages(
        @Params('chatId') chatId: string,
        @Query('limit') limit: number = 20,
        @Query('before') before?: string
    ): Promise<IChatMessage[]> {
        const query: any = { chatId };
        if (before) {
            query._id = { $lt: new ObjectId(before) };
        }

        return await ChatMessage.find(query)
            .sort({ _id: -1 })
            .limit(limit)
            .toArray();
    }

    private async getLastMessageForChat(chatId: string): Promise<IChatMessage | undefined> {
        const lastMessage = await ChatMessage.findOne(
            { chatId },
            { sort: { _id: -1 } }
        );
        return lastMessage || undefined;
    }

    @POST({ path: "/:chatId/messages" })
    async sendMessage(
        @Params('chatId') chatId: string,
        @Body('message') message: string
    ): Promise<IChatMessage> {
        if (!message) {
            throw new Error("Message is required");
        }

        const response = await Agent.ask(chatId, message);
        return response;
    }
}

export default new ChatRouter();