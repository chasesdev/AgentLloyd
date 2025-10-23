interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface TokenEstimationAccuracy {
  estimated: number;
  actual: number;
  difference: number;
  percentageError: number;
}

class TokenUsageService {
  private currentChatTokens: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cost: 0
  };
  private estimationAccuracyLog: TokenEstimationAccuracy[] = [];
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
    if (!text || text.length === 0) {
      return 0;
    }

    // Extract code blocks (both ``` and ` formats)
    const codeBlockPattern = /```[\s\S]*?```/g;
    const inlineCodePattern = /`[^`\n]+`/g;

    const codeBlocks = text.match(codeBlockPattern) || [];
    const inlineCode = text.match(inlineCodePattern) || [];

    // Calculate code content length
    const codeBlocksLength = codeBlocks.join('').length;
    const inlineCodeLength = inlineCode.join('').length;
    const totalCodeLength = codeBlocksLength + inlineCodeLength;

    // Remaining text length
    const textLength = text.length - totalCodeLength;

    // Token estimation based on research:
    // - Code: ~2 characters per token (denser tokenization)
    // - Text: ~4 characters per token (standard English)
    // - Add small buffer for whitespace and punctuation
    const codeTokens = Math.ceil(totalCodeLength / 2);
    const textTokens = Math.ceil(textLength / 4);

    // Add 5% buffer for special characters and formatting
    const totalTokens = Math.ceil((codeTokens + textTokens) * 1.05);

    return totalTokens;
  }

  /**
   * More accurate word-based estimation (alternative method)
   */
  estimateTokensByWords(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Split on whitespace
    const words = text.trim().split(/\s+/);

    // Based on OpenAI research: average ~1.3 tokens per word for English
    // Code has slightly different ratio (~1.5 tokens per "word")
    const hasCode = text.includes('```') || text.includes('`');
    const tokensPerWord = hasCode ? 1.5 : 1.3;

    return Math.ceil(words.length * tokensPerWord);
  }

  /**
   * Track estimation accuracy by comparing with actual usage
   */
  trackEstimationAccuracy(estimated: number, actual: number): void {
    const difference = actual - estimated;
    const percentageError = ((Math.abs(difference) / actual) * 100);

    this.estimationAccuracyLog.push({
      estimated,
      actual,
      difference,
      percentageError
    });

    // Keep only last 100 entries
    if (this.estimationAccuracyLog.length > 100) {
      this.estimationAccuracyLog.shift();
    }
  }

  /**
   * Get average estimation accuracy statistics
   */
  getEstimationAccuracy(): {
    averageError: number;
    averagePercentageError: number;
    totalSamples: number;
  } | null {
    if (this.estimationAccuracyLog.length === 0) {
      return null;
    }

    const totalError = this.estimationAccuracyLog.reduce((sum, entry) =>
      sum + Math.abs(entry.difference), 0
    );
    const totalPercentageError = this.estimationAccuracyLog.reduce((sum, entry) =>
      sum + entry.percentageError, 0
    );

    return {
      averageError: totalError / this.estimationAccuracyLog.length,
      averagePercentageError: totalPercentageError / this.estimationAccuracyLog.length,
      totalSamples: this.estimationAccuracyLog.length
    };
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