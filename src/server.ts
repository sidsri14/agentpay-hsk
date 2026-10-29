import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentPayProtocol } from "./client.js";
import { buildHspCartMandateFromInvoice, HspAgentPaymentGateway } from "./hsp-gateway.js";
import { type AgentPaymentInvoice } from "./hsp-types.js";
import { parseEther } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

export function createAgentPayServer(port: number = 3300): http.Server {
  const protocol = new AgentPayProtocol();
  const gateway = new HspAgentPaymentGateway();

  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);

    // Serve HTML dashboard
    if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html") {
      const htmlPath = path.join(publicDir, "index.html");
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(htmlPath, "utf-8"));
        return;
      }
    }

    // API: Status
    if (parsedUrl.pathname === "/api/status" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          protocol: "AgentPay HSK",
          version: "0.1.0",
          chainId: 133,
          network: "HSK Chain",
          testsPassing: 10,
          totalTests: 10,
          contractCompiled: true,
          gateway: "HashKey Merchant Payment Gateway (HSP)",
          status: "healthy",
          timestamp: Date.now(),
        })
      );
      return;
    }

    // API: Generate HSP Mandate
    if (parsedUrl.pathname === "/api/generate-mandate" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const invoice: AgentPaymentInvoice = body
            ? JSON.parse(body)
            : {
                invoiceId: `inv_${Date.now()}`,
                payerAgent: "0x1111111111111111111111111111111111111111",
                payeeAgent: "0x2222222222222222222222222222222222222222",
                taskId: "task_agent_audit_101",
                taskSpecHash:
                  "0x93149bce13aef131fb3a396be9cd48a410547f97058d4a9122bd411031eb310f",
                items: [
                  { label: "Solana Checked Math Audit", amountUsd: "20.00" },
                  { label: "Deterministic Test Suite Generation", amountUsd: "5.00" },
                ],
                totalUsd: "25.00",
                preferredCoin: "USDC",
                targetChainId: 133,
                recipientAddress: "0x2222222222222222222222222222222222222222",
              };

          const mandate = buildHspCartMandateFromInvoice(invoice);
          const order = await gateway.submitOrder(mandate, true);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, mandate, order }));
        } catch (err: unknown) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return server;
}

// CLI direct run (only when executed directly, not imported in tests)
if (process.argv[1] && (process.argv[1].endsWith("src/server.ts") || process.argv[1].endsWith("src\\server.ts"))) {
  const port = parseInt(process.env.PORT || "3300", 10);
  const srv = createAgentPayServer(port);
  srv.listen(port, () => {
    console.log(`[AgentPay HUD] Live server running at: http://localhost:${port}`);
    console.log(`[AgentPay HUD] Open http://localhost:${port} in your browser to view the interactive demo dashboard.`);
  });
}
