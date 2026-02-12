import { tool } from "@opencode-ai/plugin";
import { tavily } from "@tavily/core";

export default tool({
  description:
    "Search the web using Tavily API. Returns relevant search results with titles, URLs, content snippets, and relevance scores.",
  args: {
    query: tool.schema.string().describe("The search query to execute"),
    maxResults: tool.schema
      .number()
      .optional()
      .describe("Maximum number of results to return (0-20, default: 5)"),
    searchDepth: tool.schema
      .enum(["basic", "advanced"])
      .optional()
      .describe(
        "Search depth: 'basic' for generic snippets, 'advanced' for most relevant content (default: 'basic')",
      ),
    includeAnswer: tool.schema
      .boolean()
      .optional()
      .describe(
        "Include an AI-generated answer based on search results (default: false)",
      ),
    includeImages: tool.schema
      .boolean()
      .optional()
      .describe("Include related images in the response (default: false)"),
    includeDomains: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("List of domains to specifically include in results"),
    excludeDomains: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("List of domains to exclude from results"),
    timeRange: tool.schema
      .enum(["day", "week", "month", "year", "d", "w", "m", "y"])
      .optional()
      .describe(
        "Time range for results (e.g., 'day', 'week', 'month', 'year')",
      ),
  },
  async execute(args) {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }

    try {
      const client = tavily({ apiKey });

      const response = await client.search(args.query, {
        maxResults: args.maxResults,
        searchDepth: args.searchDepth,
        includeAnswer: args.includeAnswer,
        includeImages: args.includeImages,
        includeDomains: args.includeDomains,
        excludeDomains: args.excludeDomains,
        timeRange: args.timeRange,
      });

      // Format the response for better readability
      let output = `# Search Results for: "${args.query}"\n\n`;

      if (response.answer) {
        output += `## Answer\n${response.answer}\n\n`;
      }

      output += `## Sources (${response.results.length} results)\n\n`;

      response.results.forEach((result, index: number) => {
        output += `### ${index + 1}. ${result.title}\n`;
        output += `**URL:** ${result.url}\n`;
        output += `**Relevance Score:** ${result.score.toFixed(2)}\n\n`;
        output += `${result.content}\n\n`;
        output += `---\n\n`;
      });

      if (response.images && response.images.length > 0) {
        output += `## Images (${response.images.length})\n\n`;
        response.images.slice(0, 5).forEach((img, index: number) => {
          if (typeof img === "string") {
            output += `${index + 1}. ${img}\n`;
          } else {
            output += `${index + 1}. ${img.url}\n`;
            if (img.description) {
              output += `   ${img.description}\n`;
            }
          }
        });
        output += `\n`;
      }

      output += `\n*Response time: ${response.responseTime}s*`;

      return output;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Tavily search failed: ${error.message}`);
      }
      throw error;
    }
  },
});
