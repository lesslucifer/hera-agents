import { Body, ExpressRouter, GET, POST, Params, Query } from "express-router-ts";
import { Agent } from "../serv/agent";
import { Conversation } from "../models";
import { ObjectId } from "mongodb";

class AgentRouter extends ExpressRouter {
    @POST({ path: "/" })
    async query(@Body('q') q: string) {
        if (!q) return
        return await Agent.ask(q)
    }
    @GET({ path: "/conversation/:id" })
    async debug(@Params('id') id: string) {
        if (id == 'null') return await Conversation.findOne({}, { sort: { _id: -1 } })
        const conversation = await Conversation.findOne({ _id: new ObjectId(id) })
        return conversation
    }
}

export default new AgentRouter()
