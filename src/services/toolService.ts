import { ToolCall, ToolResult, AgentTool } from '../types/tools';
import { zaiService } from './zaiService';
import { codeInterpreterService, CodeExecutionResult } from './codeInterpreterService';
import { fileAnalyzerService, FileAnalysisResult } from './fileAnalyzerService';
import { SecureStorage } from '../utils/secureStorage';
import axios from 'axios';
export class ToolService {
  private tools: Map<string, AgentTool> = new Map();
  constructor() {
    this.initializeTools();
  }
  private initializeTools() {
    this.tools.set('web_search', {
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the web for current information',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', default: 10, description: 'Number of results to return' }
      },
      enabled: true,
    });
    this.tools.set('code_interpreter', {
      id: 'code_interpreter',
      name: 'Code Interpreter',
      description: 'Execute code and analyze results',
      parameters: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', default: 'python', description: 'Programming language' }
      },
      enabled: true,
    });
    this.tools.set('file_analyzer', {
      id: 'file_analyzer',
      name: 'File Analyzer',
      description: 'Analyze uploaded files and documents',
      parameters: {
        file_path: { type: 'string', description: 'Path to the file' },
        analysis_type: { type: 'string', default: 'auto', description: 'Type of analysis to perform' }
      },
      enabled: true,
    });
  }
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.function.name);
    if (!tool || !tool.enabled) {
      throw new Error(`Tool ${toolCall.function.name} not found or disabled`);
    }
    const args = JSON.parse(toolCall.function.arguments);
    switch (toolCall.function.name) {
      case 'web_search':
        return await this.executeWebSearch(args);
      case 'code_interpreter':
        return await this.executeCodeInterpreter(args);
      case 'file_analyzer':
        return await this.executeFileAnalyzer(args);
      default:
        throw new Error(`Unknown tool: ${toolCall.function.name}`);
    }
  }
  private async executeWebSearch(args: { query: string; num_results?: number }): Promise<ToolResult> {
    try {
      const apiKey = await SecureStorage.getApiKey('zai_api_key');
      if (!apiKey) {
        throw new Error('API key not set');
      }

      const response = await axios.post(
        'https://api.z.ai/api/paas/v4/chat/completions',
        {
          model: 'glm-4.6',
          messages: [
            {
              role: 'user',
              content: `Search the web for: ${args.query}. Provide ${args.num_results || 10} relevant results.`
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Search the web for information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Search query' },
                    num: { type: 'number', description: 'Number of results' }
                  },
                  required: ['query']
                }
              }
            }
          ],
          tool_choice: 'auto',
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const choice = response.data.choices[0];
      const content = choice.message.content || JSON.stringify(choice.message.tool_calls || [], null, 2);

      return {
        tool_call_id: 'web_search_' + Date.now(),
        result: content
      };
    } catch (error) {
      console.error('Web search failed:', error);
      return {
        tool_call_id: 'web_search_' + Date.now(),
        result: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  private async executeCodeInterpreter(args: { code: string; language?: string }): Promise<ToolResult> {
    try {
      const language = (args.language || 'python') as any;
      const supportedLanguages = codeInterpreterService.getSupportedLanguages();
      if (!supportedLanguages.includes(language)) {
        throw new Error(`Unsupported language: ${language}. Supported: ${supportedLanguages.join(', ')}`);
      }
      const result = await codeInterpreterService.executeCode({
        code: args.code,
        language,
        timeout: 10000 
      });
      let output = '';
      if (result.success) {
        output = `✅ **Execution Successful**\n\n`;
        output += `**Language:** ${language}\n`;
        output += `**Execution Time:** ${result.executionTime}ms\n\n`;
        output += `**Output:**\n\`\`\`\n${result.output || 'No output'}\n\`\`\``;
        if (result.stdout) {
          output += `\n**Stdout:**\n\`\`\`\n${result.stdout}\n\`\`\``;
        }
      } else {
        output = `❌ **Execution Failed**\n\n`;
        output += `**Language:** ${language}\n`;
        output += `**Execution Time:** ${result.executionTime}ms\n\n`;
        output += `**Error:**\n\`\`\`\n${result.error}\n\`\`\``;
        if (result.stderr) {
          output += `\n**Stderr:**\n\`\`\`\n${result.stderr}\n\`\`\``;
        }
      }
      return {
        tool_call_id: 'code_interpreter_' + Date.now(),
        result: output
      };
    } catch (error) {
      console.error('Code execution failed:', error);
      return {
        tool_call_id: 'code_interpreter_' + Date.now(),
        result: `❌ **Code execution failed:** ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  private async executeFileAnalyzer(args: { file_path: string; analysis_type?: string }): Promise<ToolResult> {
    try {
      const analysisType = (args.analysis_type || 'auto') as any;
      let result: FileAnalysisResult;
      if (args.file_path.includes('image') || analysisType === 'image') {
        result = await fileAnalyzerService.pickAndAnalyzeImage();
      } else {
        result = await fileAnalyzerService.pickAndAnalyzeFile(analysisType);
      }
      let output = '';
      if (result.success) {
        output = `📄 **File Analysis Complete**\n\n`;
        output += `**File:** ${result.fileName}\n`;
        output += `**Type:** ${result.fileType}\n`;
        output += `**Size:** ${this.formatFileSize(result.size)}\n`;
        output += `**Processing Time:** ${result.processingTime}ms\n\n`;
        output += `**Summary:**\n${result.analysis.summary}\n\n`;
        if (result.analysis.keyPoints.length > 0) {
          output += `**Key Points:**\n`;
          result.analysis.keyPoints.forEach(point => {
            output += `• ${point}\n`;
          });
          output += '\n';
        }
        if (result.analysis.entities.length > 0) {
          output += `**Entities:**\n`;
          result.analysis.entities.forEach(entity => {
            output += `• ${entity}\n`;
          });
          output += '\n';
        }
        if (result.analysis.sentiment) {
          output += `**Sentiment:** ${result.analysis.sentiment}\n\n`;
        }
        if (result.analysis.language) {
          output += `**Language:** ${result.analysis.language}\n\n`;
        }
        if (result.extractedText && result.extractedText.length < 500) {
          output += `**Extracted Text:**\n\`\`\`\n${result.extractedText}\n\`\`\``;
        } else if (result.extractedText) {
          output += `**Extracted Text:**\n\`\`\`\n${result.extractedText.slice(0, 500)}...\n\`\`\``;
        }
      } else {
        output = `❌ **File Analysis Failed**\n\n`;
        output += `**Error:** ${result.error}\n`;
        output += `**Processing Time:** ${result.processingTime}ms`;
      }
      return {
        tool_call_id: 'file_analyzer_' + Date.now(),
        result: output
      };
    } catch (error) {
      console.error('File analysis failed:', error);
      return {
        tool_call_id: 'file_analyzer_' + Date.now(),
        result: `❌ **File analysis failed:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n💡 **Tip:** Make sure to select a file when prompted.`
      };
    }
  }
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  getAvailableTools(): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.enabled);
  }
  enableTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = true;
    }
  }
  disableTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = false;
    }
  }
  getToolSchema(): any[] {
    return this.getAvailableTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: Object.keys(tool.parameters).filter(key => 
            !tool.parameters[key].hasOwnProperty('default')
          )
        }
      }
    }));
  }
}
export const toolService = new ToolService();