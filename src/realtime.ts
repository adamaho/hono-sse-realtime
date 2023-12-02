import { randomUUID } from "node:crypto";
import { ReadableStream, ReadableStreamDefaultController } from "node:stream/web";

type SseEvent<T> = {
    id?: string;
    name?: string;
    data?: T;
};

class Realtime {
    private stores: Map<string, Map<string, ReadableStreamDefaultController>>;

    constructor() {
        this.stores = new Map();
    }

    public stream<T>(store_key: string, initialEvent?: SseEvent<T>): Response {
        const id = randomUUID();
        const stream = new ReadableStream({
            start: async (controller) => {
                let store = this.stores.get(store_key);
                if (!store) {
                    store = new Map();
                }
                store.set(id, controller);
                this.stores.set(store_key, store);
                if (initialEvent) controller.enqueue(this.event(initialEvent));
            },
            cancel: () => {
                const store = this.stores.get(store_key);
                if (!store) return;
                store.delete(id);
                this.stores.set(store_key, store);
            }
        });

        return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    }

    public send<T>(store_key: string, event: SseEvent<T>) {
        const store = this.stores.get(store_key);
        if (!store) return;
        for (const client of store.values()) {
            client.enqueue(this.event(event));
        }
    }

    private event<T>(event: SseEvent<T>) {
        const lines = [event?.id && `id: ${event?.id}`, event?.name && `event: ${event.name}`, event?.data && `data: ${JSON.stringify(event.data)}`];
        return lines.filter(Boolean).join("\n").concat("\n\n");
    }
}


export const realtime = new Realtime();
