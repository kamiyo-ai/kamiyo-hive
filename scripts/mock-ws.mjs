import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 4021 });

const agents = ["kamiyo", "oracle", "chaos", "sage"];
const colors = {
  kamiyo: "#00f0ff",
  oracle: "#9944ff",
  chaos: "#ff44f5",
  sage: "#ffaa22",
};

const eventTemplates = [
  { type: "debate:message", category: "debate", data: (s, t) => ({ content: `${s} challenges ${t} on consensus mechanisms and distributed proof validation` }) },
  { type: "debate:start", category: "debate", data: () => ({ topic: "zero-knowledge proof optimization" }) },
  { type: "debate:synthesize", category: "debate", data: () => ({ result: "consensus reached" }) },
  { type: "tweet:posted", category: "tweet", data: () => ({ content: "The network sees all. Proof is truth." }) },
  { type: "mention:received", category: "mention", data: () => ({ from: "anon_user_42", text: "what is kamiyo?" }) },
  { type: "mood:transition", category: "mood", data: () => ({ from: "neutral", to: ["contemplative", "aggressive", "curious", "excited"][Math.floor(Math.random() * 4)] }) },
  { type: "payment:request", category: "payment", data: () => ({ service: "oracle-query", amount: (Math.random() * 5).toFixed(2) }) },
  { type: "payment:verified", category: "payment", data: () => ({ service: "oracle-query", tx: "0x" + Math.random().toString(16).slice(2, 10) }) },
  { type: "proof:generating", category: "proof", data: () => ({ type: "zk-snark" }) },
  { type: "proof:complete", category: "proof", data: () => ({ type: "zk-snark", timeMs: Math.floor(200 + Math.random() * 800) }) },
];

function randomAgent(exclude) {
  const pool = exclude ? agents.filter((a) => a !== exclude) : agents;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeEvent() {
  const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
  const source = randomAgent();
  const target = randomAgent(source);
  return {
    id: crypto.randomUUID(),
    type: template.type,
    category: template.category,
    timestamp: Date.now(),
    source,
    target,
    data: template.data(source, target),
    visual: {
      color: colors[source],
      intensity: 0.5 + Math.random() * 0.5,
      duration: 1000 + Math.random() * 2000,
    },
  };
}

wss.on("connection", (ws) => {
  console.log("client connected");
  ws.send(JSON.stringify({ type: "replay", events: Array.from({ length: 10 }, makeEvent) }));

  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: "event", event: makeEvent() }));
  }, 800 + Math.random() * 1500);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("client disconnected");
  });
});

console.log("Mock WS server running on ws://localhost:4021");
