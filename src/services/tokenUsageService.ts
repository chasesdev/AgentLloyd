interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}
class TokenUsageService {
  private currentChatTokens: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cost: 0
  };
  private readonly TOKEN_COSTS = {
    'glm-4.6': {
      input: 0.005,  
      output: 0.015  
    },
    'glm-4.5v': {
      input: 0.003,
      output: 0.009
    },
    'glm-4.5-air': {
      input: 0.001,
      output: 0.003
    }
  };
  updateTokenUsage(
    model: string, 
    inputTokens: number, 
    outputTokens: number
  ): void {
    const costs = this.TOKEN_COSTS[model as keyof typeof this.TOKEN_COSTS] || this.TOKEN_COSTS['glm-4.6'];
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    const totalCost = inputCost + outputCost;
    const totalTokens = inputTokens + outputTokens;
    this.currentChatTokens = {
      inputTokens: this.currentChatTokens.inputTokens + inputTokens,
      outputTokens: this.currentChatTokens.outputTokens + outputTokens,
      totalTokens: this.currentChatTokens.totalTokens + totalTokens,
      cost: this.currentChatTokens.cost + totalCost
    };
  }
  getCurrentChatUsage(): TokenUsage {
    return { ...this.currentChatTokens };
  }
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return '<$0.01';
    }
    return `$${cost.toFixed(3)}`;
  }
  formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }
  resetCurrentChat(): void {
    this.currentChatTokens = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0
    };
  }
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  extractTokenUsage(response: any): { input: number; output: number } | null {
    try {
      const usage = response?.usage;
      if (usage) {
        return {
          input: usage.prompt_tokens || 0,
          output: usage.completion_tokens || 0
        };
      }
    } catch (error) {
      console.error('Failed to extract token usage:', error);
    }
    return null;
  }
}
export const tokenUsageService = new TokenUsageService();