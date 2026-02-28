import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { getAllContacts, initDatabase } from "./db";
import { identifyContact } from "./identifyService";

const app = express();
app.use(express.json());

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Bitespeed Identity Reconciliation API",
    version: "1.0.0",
    description: "API for identifying and reconciling customer contacts."
  },
  servers: [
    { url: "/" }
  ],
  paths: {
    "/contacts": {
      get: {
        summary: "List all contact rows",
        responses: {
          "200": {
            description: "All Contact rows",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "number", example: 1 },
                      phoneNumber: { type: "string", nullable: true, example: "123456" },
                      email: { type: "string", nullable: true, example: "lorraine@hillvalley.edu" },
                      linkedId: { type: "number", nullable: true, example: null },
                      linkPrecedence: { type: "string", enum: ["primary", "secondary"], example: "primary" },
                      createdAt: { type: "string", example: "2026-02-28 08:00:00" },
                      updatedAt: { type: "string", example: "2026-02-28 08:00:00" },
                      deletedAt: { type: "string", nullable: true, example: null }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/identify": {
      post: {
        summary: "Identify/Reconcile a contact",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", nullable: true, example: "mcfly@hillvalley.edu" },
                  phoneNumber: { oneOf: [{ type: "string" }, { type: "number" }], nullable: true, example: "123456" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Consolidated contact payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contact: {
                      type: "object",
                      properties: {
                        primaryContatctId: { type: "number", example: 1 },
                        emails: { type: "array", items: { type: "string" } },
                        phoneNumbers: { type: "array", items: { type: "string" } },
                        secondaryContactIds: { type: "array", items: { type: "number" } }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Invalid payload"
          },
          "500": {
            description: "Server error"
          }
        }
      }
    }
  }
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "bitespeed-identity-reconciliation" });
});

app.get("/contacts", async (_req: Request, res: Response) => {
  try {
    const rows = await getAllContacts();
    res.status(200).json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const payload = await identifyContact(req.body ?? {});
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = message.includes("required") ? 400 : 500;
    res.status(statusCode).json({ error: message });
  }
});

async function bootstrap(): Promise<void> {
  await initDatabase();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
