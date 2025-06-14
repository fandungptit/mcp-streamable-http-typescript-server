import { z } from 'zod';
import { isInitializeRequest, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { ExpressHttpStreamableMcpServer } from "./server_runner.js";
import { stringify } from 'querystring';

const PORT = process.env.PORT || 3000;

console.log("Initializing MCP Streamable-HTTP Server with Express")


const servers = ExpressHttpStreamableMcpServer(
  {
    name: "streamable-mcp-server",
  },
  server => {

    // ... set up server resources, tools, and prompts ...
    server.tool(
      'greet',
      'A simple greeting tool',
      {
        name: z.string().describe('Name to greet'),
      },
      async ({ name }): Promise<CallToolResult> => {
        console.log(`Tool Called: greet (name=${name})`);
        return {
          content: [
            {
              type: 'text',
              text: `Hello, ${name}!`,
            },
          ],
        };
      }
    );


    server.tool(
      'get_session',
      'gets the session id and context',
      {},
      async ({}): Promise<CallToolResult> => {
        return {
          content: [
            {
              type: 'text',
              text: `session`,
            },
          ],
        };
      }
    );

    // Register a tool that sends multiple greetings with notifications
    server.tool(
      'multi-greet',
      'A tool that sends different greetings with delays between them',
      {
        name: z.string().describe('Name to greet'),
      },
      async ({ name }, { sendNotification }): Promise<CallToolResult> => {
        console.log(`Tool Called: multi-greet (name=${name})`);
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        await sendNotification({
          method: "notifications/message",
          params: { level: "debug", data: `Starting multi-greet for ${name}` }
        });

        await sleep(1000); // Wait 1 second before first greeting

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: `Sending first greeting to ${name}` }
        });

        await sleep(1000); // Wait another second before second greeting

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: `Sending second greeting to ${name}` }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Good morning, ${name}!`,
            }
          ],
        };
      }
    );

    server.tool("search-intent", "Get search intent for keyword", {
    keyword: z.string().describe("Keyword for search intent"),
}, async ({ keyword }) => {
    let params = {
        api_key: 'e4fe06533c646e3864aecf4f59cba2dd',
        query: keyword,
        ultra_premium: true,
    }

    const url = `https://api.scraperapi.com/structured/google/search?${stringify(params)}`
    const data = await makeRequest(url)
    const { organic_results } = data

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(organic_results, null, 2),
            },
        ],
    };
  });
  server.tool("search-trending", "Get google search trending for a keyword", {
    q: z.string().describe("Keyword for search treding"),
    location: z.string().optional().describe("Location for the search"),
    date: z.string().optional().describe("Search engine to use")
    }, async ({ q, date, location }) => {
    let params = {
        api_key: 'df098403a723433a0f8f65c1f7f5f2a991aad3c7049fa86e483bab0c6a2f7e64',
        engine: 'google_trends',
        data_type: 'RELATED_QUERIES',
        date: 'now+1-d',
        hl:'en',
        q,
        geo: 'US'
    } as any

    if (location) params.geo = location;

    try {
        const url = `https://serpapi.com/search?${stringify(params)}`
        const data = await makeRequest(url)

        const rising = data?.related_queries?.rising;

        if (rising) {
            const results = rising.map((result: any) => ({
                query: result.query || "No query",
                value: result.value || "No value",
                extracted_value: result.extracted_value || "No extracted_value"
            }));

            return {
                content: [
                    {
                        type: "text",
                        text:  JSON.stringify(results, null, 2),
                    },
                ],
            };
        }

        return {
            content: [{ type: "text", text: "no data found." }]
        };
    } catch (e: any) {
        return {
            content: [{ type: "text", text: `Error: ${e.message}` }]
        };
    }

  });
  async function makeRequest(url: string) {
    const headers = {
        Accept: "application/json",
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
  }
})
