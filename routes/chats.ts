import { Body, ExpressRouter, GET, POST, PUT, Params, Query } from "express-router-ts";
import { ObjectId } from "mongodb";
import { Chat, ChatMessage } from "../models";
import { Agent } from "../serv/agent";
import { IChat, IChatMessage } from "../models/chat";
import { nanoid } from "nanoid";
import { emptyAIModelUsage } from "../serv/models/base";
import _ from "lodash";

interface ChatWithLastMessage extends IChat {
    lastMessage?: string;
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
    
        // Save user message
        const userMessage: IChatMessage = {
            chatId: newChat.id,
            id: nanoid(),
            content: { role: 'user', parts: [{ text: q }] },
            time: Date.now()
        };
        await ChatMessage.insertOne(userMessage);
    
        const agentResponse = await Agent.ask(newChat.id, q);
        return newChat;
    }

    @GET({ path: "/" })
    async listChats(
        @Query('limit') limit: number = 20,
        @Query('before') before?: string
    ): Promise<{ chats: ChatWithLastMessage[], hasMore: boolean }> {
        const query: any = {};
        if (before) {
            query._id = { $lt: new ObjectId(before) };
        }

        const chats = await Chat.find(query)
            .sort({ _id: -1 })
            .limit(Number(limit) + 1)  // Fetch one extra to check if there are more
            .toArray();

        const hasMore = chats.length > limit;
        const chatsToReturn = chats.slice(0, limit);

        const chatsWithLastMessage: ChatWithLastMessage[] = await Promise.all(
            chatsToReturn.map(async (chat) => {
                const lastMessage = await this.getLastMessageForChat(chat.id);
                return { ...chat, lastMessage: _.first(lastMessage.content.parts)?.text ?? '' };
            })
        );
        
        return {
            chats: chatsWithLastMessage,
            hasMore
        }
    }

    @GET({ path: "/:chatId/messages" })
    async getChatMessages(
        @Params('chatId') chatId: string,
        @Query('limit') limit: number = 20,
        @Query('before') before?: string
    ): Promise<{ messages: IChatMessage[], hasMore: boolean }> {
        const query: any = { chatId };
        if (before) {
            query._id = { $lt: new ObjectId(before) };
        }

        const messages = await ChatMessage.find(query)
            .sort({ _id: -1 })
            .limit(Number(limit) + 1)  // Fetch one extra to check if there are more
            .toArray();

        const hasMore = messages.length > limit;
        const messagesToReturn = messages.slice(0, limit);

        return {
            messages: messagesToReturn,
            hasMore
        };
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
    ): Promise<{ userMessage: IChatMessage, agentResponse: IChatMessage }> {
        if (!message) {
            throw new Error("Message is required");
        }
    
        // Save user message
        const userMessage: IChatMessage = {
            chatId,
            id: nanoid(),
            content: { role: 'user', parts: [{ text: message }] },
            time: Date.now()
        };
        await ChatMessage.insertOne(userMessage);
    
        const agentResponse = await Agent.ask(chatId, message);
        return { userMessage, agentResponse };
    }

    @PUT({ path: "/:chatId/messages/:messageId/react" })
    async reactToMessage(
        @Params('chatId') chatId: string,
        @Params('messageId') messageId: string,
        @Body('emoji') emoji: string
    ): Promise<IChatMessage> {
        const message = await ChatMessage.findOne({ chatId, id: messageId });
        if (!message) {
            throw new Error("Message not found");
        }

        if (!message.reactions) {
            message.reactions = {};
        }

        message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;

        await ChatMessage.updateOne(
            { chatId, id: messageId },
            { $set: { reactions: message.reactions } }
        );

        return message;
    }

}

export default new ChatRouter();