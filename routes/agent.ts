import { Body, ExpressRouter, GET, POST, Query } from "express-router-ts";
import { Agent } from "../serv/agent";

class AgentRouter extends ExpressRouter {
    @POST({path: "/"})
    async checkHealth(@Body('q') q: string) {
        if (!q) return
        return await Agent.ask(q)
    }
}

export default new AgentRouter()
