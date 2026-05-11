import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";

const server = new McpServer({
  name: "Weather Server",
  version: "1.0.0"
});

server.registerResource(
  "getting-started",
  "weather://getting-started",
  {
    title: "Getting Started",
    description: "Quick guide for using the Weather Server MCP tools.",
    mimeType: "text/markdown"
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# Getting Started

This MCP server provides weather data using Open-Meteo.

## Available tools

- \`get-weather\`: Fetches current and short-term forecast data for a city.

## Example

Call \`get-weather\` with:

\`\`\`json
{
  "city": "Nairobi"
}
\`\`\`

The tool resolves the city to coordinates, fetches the current weather and one-day hourly forecast, then returns the raw weather data as formatted JSON.`
      }
    ]
  })
);

server.registerPrompt(
  "weather-report",
  {
    title: "Weather Report",
    description: "Create a concise weather report for a city using this server's weather tool.",
    argsSchema: {
      city: z.string().describe("The city to get the weather report for"),
      focus: z.string().optional().describe("Optional area to emphasize, such as rain, temperature, or travel planning")
    }
  },
  async ({ city, focus }) => ({
    description: `Weather report for ${city}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Use the get-weather tool to fetch weather data for ${city}. Then write a concise, practical weather report.${focus ? ` Focus especially on ${focus}.` : ""}

Include:
- current temperature and apparent temperature
- humidity and precipitation
- any notable short-term forecast changes
- one brief recommendation for someone planning their day`
        }
      }
    ]
  })
);

server.registerTool(
  'get-weather',
  {
    description: 'Tool to get the weather of a city',
    inputSchema: z.object({ city: z.string().describe("The name of the city to get the weather for") }),
  },
  async({ city }) => {
    try {
      // Step 1: Get coordinates for the city
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
      );
      const geoData = await geoResponse.json();

      // Handle city not found
      if (!geoData.results || geoData.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Sorry, I couldn't find a city named "${city}". Please check the spelling and try again.`
            }
          ]
        };
      }

      // Step 2: Get weather data using coordinates
      const { latitude, longitude } = geoData.results[0];
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&hourly=temperature_2m,precipitation&forecast_days=1`
      );

      const weatherData = await weatherResponse.json();

      // Return the complete weather data as JSON
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(weatherData, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching weather data: ${error?.message}`
          }
        ]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
