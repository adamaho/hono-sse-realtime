import fs from "node:fs";
import { serve } from '@hono/node-server'
import { createSecureServer } from 'node:http2';
import { Hono } from 'hono'
import { z } from "zod";

import { realtime } from "./realtime";
import { validator } from "hono/validator";
import { randomUUID } from "node:crypto";

const todoSchema = z.object({
    id: z.string(),
    description: z.string(),
    checked: z.boolean()
});
type Todo = z.infer<typeof todoSchema>;
const todos: Map<string, Todo> = new Map();
const app = new Hono()

app.get('/todos', async () => {
    return realtime.stream("todos", { name: "todos", data: Array.from(todos.values()) });
});

app.put('/todos/:id',
    validator("json", (value, c) => {
        const parsed = todoSchema.omit({ id: true }).safeParse(value);
        if (!parsed.success) return c.text("oopsie", 400);
        return parsed.data;
    }),
    async (c) => {
        const id = c.req.param("id");
        const current_todo = todos.get(id);
        if (!current_todo) return c.text("wrong one pal", 404);
        const updated_todo = c.req.valid("json");
        const todo = { id, ...updated_todo };
        todos.set(id, todo);
        realtime.send("todos", { name: "update_todo", data: { id, data: todo }});
        return c.text("Todo updated.", 200);
    });

app.post('/todos',
    validator("json", (value, c) => {
        const parsed = todoSchema.omit({ id: true }).safeParse(value);
        if (!parsed.success) return c.text("oopsie", 400);
        return parsed.data;
    }),
    async (c) => {
        const id = randomUUID();
        const new_todo = c.req.valid("json");
        const todo = { id, ...new_todo };
        todos.set(id, todo);
        realtime.send("todos", { name: "add_todo", data: todo });
        return c.text("Todo created.", 201);
    });

serve({
    fetch: app.fetch,
    port: 3000,
    createServer: createSecureServer,
    serverOptions: {
        key: fs.readFileSync("key.pem"),
        cert: fs.readFileSync("cert.pem")
    }
})
