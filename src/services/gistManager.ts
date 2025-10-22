import { githubService } from './githubService';
import { chatDatabase } from './chatDatabase';
import { SecureStorage } from '../utils/secureStorage';
interface GistContent {
  filename: string;
  content: string;
  description?: string;
}
interface ChatGist {
  id: string;
  chatId: string;
  gistId: string;
  gistUrl: string;
  title: string;
  description: string;
  content: GistContent[];
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}
interface GistTemplate {
  name: string;
  description: string;
  template: (messages: any[], chatId: string, title?: string) => GistContent[];
}
class GistManager {
  private gists: Map<string, ChatGist> = new Map();
  private templates: Map<string, GistTemplate> = new Map();
  constructor() {
    this.initializeTemplates();
  }
  private initializeTemplates() {
    this.templates.set('planning', {
      name: 'Planning Analysis',
      description: 'Structured planning and analysis document',
      template: (messages, chatId, title) => {
        const content = this.generatePlanningMarkdown(messages, chatId, title);
        return [{
          filename: `${title || 'planning'}-${chatId.slice(-8)}.md`,
          content,
          description: 'Planning analysis and strategic breakdown'
        }];
      }
    });
    this.templates.set('code-review', {
      name: 'Code Review',
      description: 'Code review and improvements documentation',
      template: (messages, chatId, title) => {
        const content = this.generateCodeReviewMarkdown(messages, chatId, title);
        return [{
          filename: `${title || 'code-review'}-${chatId.slice(-8)}.md`,
          content,
          description: 'Code review and technical analysis'
        }];
      }
    });
    this.templates.set('meeting-notes', {
      name: 'Meeting Notes',
      description: 'Meeting summary and action items',
      template: (messages, chatId, title) => {
        const content = this.generateMeetingNotesMarkdown(messages, chatId, title);
        return [{
          filename: `${title || 'meeting-notes'}-${chatId.slice(-8)}.md`,
          content,
          description: 'Meeting notes and action items'
        }];
      }
    });
    this.templates.set('technical-docs', {
      name: 'Technical Documentation',
      description: 'Technical documentation and specifications',
      template: (messages, chatId, title) => {
        const content = this.generateTechnicalDocsMarkdown(messages, chatId, title);
        return [{
          filename: `${title || 'technical-docs'}-${chatId.slice(-8)}.md`,
          content,
          description: 'Technical documentation'
        }];
      }
    });
    this.templates.set('research', {
      name: 'Research Summary',
      description: 'Research findings and analysis',
      template: (messages, chatId, title) => {
        const content = this.generateResearchMarkdown(messages, chatId, title);
        return [{
          filename: `${title || 'research'}-${chatId.slice(-8)}.md`,
          content,
          description: 'Research summary and findings'
        }];
      }
    });
  }
  async createOrUpdateGist(
    chatId: string,
    messages: any[],
    templateType: string = 'planning',
    title?: string,
    description?: string,
    isPublic: boolean = false,
    tags: string[] = []
  ): Promise<ChatGist> {
    const template = this.templates.get(templateType);
    if (!template) {
      throw new Error(`Template '${templateType}' not found`);
    }
    const existingGist = this.getChatGist(chatId);
    const content = template.template(messages, chatId, title);
    const now = new Date();
    if (existingGist) {
      const updatedGist: ChatGist = {
        ...existingGist,
        content,
        title: title || existingGist.title,
        description: description || existingGist.description,
        updatedAt: now,
        tags: tags.length > 0 ? tags : existingGist.tags
      };
      this.gists.set(chatId, updatedGist);
      await this.updateGitHubGist(updatedGist);
      return updatedGist;
    } else {
      const gistId = this.generateGistId();
      const gistUrl = `https:
      const newGist: ChatGist = {
        id: `gist-${chatId}`,
        chatId,
        gistId,
        gistUrl,
        title: title || `${template.name} - ${chatId.slice(-8)}`,
        description: description || template.description,
        content,
        createdAt: now,
        updatedAt: now,
        isPublic,
        tags
      };
      this.gists.set(chatId, newGist);
      await this.createGitHubGist(newGist);
      return newGist;
    }
  }
  getChatGist(chatId: string): ChatGist | undefined {
    return this.gists.get(chatId);
  }
  getAllGists(): ChatGist[] {
    return Array.from(this.gists.values());
  }
  getGistsByTag(tag: string): ChatGist[] {
    return Array.from(this.gists.values())
      .filter(gist => gist.tags.includes(tag));
  }
  async deleteGist(chatId: string): Promise<void> {
    const gist = this.gists.get(chatId);
    if (gist) {
      await this.deleteGitHubGist(gist.gistId);
      this.gists.delete(chatId);
    }
  }
  private async createGitHubGist(gist: ChatGist): Promise<void> {
    try {
      if (!githubService.isAuthenticated()) {
        throw new Error('GitHub authentication required');
      }
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) {
        throw new Error('GitHub token not found');
      }
      const files: Record<string, { content: string }> = {};
      gist.content.forEach(file => {
        files[file.filename] = {
          content: file.content
        };
      });
      const response = await fetch('https:
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: gist.description,
          public: gist.isPublic,
          files
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create gist: ${errorData.message || response.statusText}`);
      }
      const data = await response.json();
      gist.gistId = data.id;
      gist.gistUrl = data.html_url;
      console.log('GitHub gist created successfully:', data.html_url);
    } catch (error) {
      console.error('Failed to create GitHub gist:', error);
      throw error;
    }
  }
  private async updateGitHubGist(gist: ChatGist): Promise<void> {
    try {
      if (!githubService.isAuthenticated()) {
        throw new Error('GitHub authentication required');
      }
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) {
        throw new Error('GitHub token not found');
      }
      const files: Record<string, { content: string }> = {};
      gist.content.forEach(file => {
        files[file.filename] = {
          content: file.content
        };
      });
      const response = await fetch(`https:
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: gist.description,
          files
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to update gist: ${errorData.message || response.statusText}`);
      }
      const data = await response.json();
      gist.gistUrl = data.html_url;
      console.log('GitHub gist updated successfully:', data.html_url);
    } catch (error) {
      console.error('Failed to update GitHub gist:', error);
      throw error;
    }
  }
  private async deleteGitHubGist(gistId: string): Promise<void> {
    try {
      if (!githubService.isAuthenticated()) {
        throw new Error('GitHub authentication required');
      }
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) {
        throw new Error('GitHub token not found');
      }
      const response = await fetch(`https:
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete gist: ${errorData.message || response.statusText}`);
      }
      console.log('GitHub gist deleted successfully:', gistId);
    } catch (error) {
      console.error('Failed to delete GitHub gist:', error);
      throw error;
    }
  }
  private generatePlanningMarkdown(messages: any[], chatId: string, title?: string): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    let markdown = `# ${title || 'Planning Analysis'}\n\n`;
    markdown += `> **Generated on:** ${date} at ${time}\n`;
    markdown += `> **Chat ID:** ${chatId.slice(-8)}\n\n`;
    const sections = this.extractPlanningSections(messages);
    if (sections.objectives.length > 0) {
      markdown += `## 🎯 Objectives\n\n`;
      sections.objectives.forEach(obj => {
        markdown += `- ${obj}\n`;
      });
      markdown += `\n`;
    }
    if (sections.analysis.length > 0) {
      markdown += `## 🔍 Analysis\n\n`;
      sections.analysis.forEach(analysis => {
        markdown += `${analysis}\n\n`;
      });
    }
    if (sections.steps.length > 0) {
      markdown += `## 📋 Action Steps\n\n`;
      sections.steps.forEach((step, index) => {
        markdown += `${index + 1}. ${step}\n`;
      });
      markdown += `\n`;
    }
    if (sections.considerations.length > 0) {
      markdown += `## ⚠️ Considerations\n\n`;
      sections.considerations.forEach(consideration => {
        markdown += `- ${consideration}\n`;
      });
      markdown += `\n`;
    }
    if (sections.timeline.length > 0) {
      markdown += `## 📅 Timeline\n\n`;
      sections.timeline.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += `\n`;
    }
    markdown += `## 💬 Conversation Summary\n\n`;
    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      markdown += `### ${role} - ${timestamp}\n\n`;
      markdown += `${this.truncateText(msg.content, 200)}\n\n`;
    });
    markdown += `---\n\n`;
    markdown += `*This document was automatically generated from a chat conversation.*\n`;
    return markdown;
  }
  private generateCodeReviewMarkdown(messages: any[], chatId: string, title?: string): string {
    const date = new Date().toLocaleDateString();
    let markdown = `# ${title || 'Code Review'}\n\n`;
    markdown += `> **Review Date:** ${date}\n`;
    markdown += `> **Chat ID:** ${chatId.slice(-8)}\n\n`;
    const codeSections = this.extractCodeSections(messages);
    if (codeSections.issues.length > 0) {
      markdown += `## 🐛 Issues Found\n\n`;
      codeSections.issues.forEach((issue, index) => {
        markdown += `### Issue ${index + 1}: ${issue.title}\n\n`;
        markdown += `**Description:** ${issue.description}\n\n`;
        markdown += `**Severity:** ${issue.severity}\n\n`;
        if (issue.suggestion) {
          markdown += `**Suggestion:** ${issue.suggestion}\n\n`;
        }
        markdown += `---\n\n`;
      });
    }
    if (codeSections.improvements.length > 0) {
      markdown += `## ✨ Improvements\n\n`;
      codeSections.improvements.forEach((improvement, index) => {
        markdown += `### ${index + 1}. ${improvement.title}\n\n`;
        markdown += `${improvement.description}\n\n`;
        if (improvement.code) {
          markdown += `\`\`\`\n${improvement.code}\n\`\`\`\n\n`;
        }
      });
    }
    if (codeSections.bestPractices.length > 0) {
      markdown += `## 📚 Best Practices\n\n`;
      codeSections.bestPractices.forEach(practice => {
        markdown += `- ${practice}\n`;
      });
      markdown += `\n`;
    }
    return markdown;
  }
  private generateMeetingNotesMarkdown(messages: any[], chatId: string, title?: string): string {
    const date = new Date().toLocaleDateString();
    let markdown = `# ${title || 'Meeting Notes'}\n\n`;
    markdown += `> **Date:** ${date}\n`;
    markdown += `> **Chat ID:** ${chatId.slice(-8)}\n\n`;
    const meetingSections = this.extractMeetingSections(messages);
    if (meetingSections.attendees.length > 0) {
      markdown += `## 👥 Attendees\n\n`;
      meetingSections.attendees.forEach(attendee => {
        markdown += `- ${attendee}\n`;
      });
      markdown += `\n`;
    }
    if (meetingSections.topics.length > 0) {
      markdown += `## 📋 Topics Discussed\n\n`;
      meetingSections.topics.forEach((topic, index) => {
        markdown += `${index + 1}. ${topic}\n`;
      });
      markdown += `\n`;
    }
    if (meetingSections.decisions.length > 0) {
      markdown += `## ✅ Decisions Made\n\n`;
      meetingSections.decisions.forEach(decision => {
        markdown += `- ${decision}\n`;
      });
      markdown += `\n`;
    }
    if (meetingSections.actionItems.length > 0) {
      markdown += `## 🎯 Action Items\n\n`;
      meetingSections.actionItems.forEach((item, index) => {
        markdown += `${index + 1}. **${item.task}** - ${item.assignee || 'Unassigned'}\n`;
        if (item.dueDate) {
          markdown += `   - Due: ${item.dueDate}\n`;
        }
      });
      markdown += `\n`;
    }
    return markdown;
  }
  private generateTechnicalDocsMarkdown(messages: any[], chatId: string, title?: string): string {
    const date = new Date().toLocaleDateString();
    let markdown = `# ${title || 'Technical Documentation'}\n\n`;
    markdown += `> **Documented:** ${date}\n`;
    markdown += `> **Chat ID:** ${chatId.slice(-8)}\n\n`;
    const techSections = this.extractTechnicalSections(messages);
    if (techSections.overview) {
      markdown += `## 📖 Overview\n\n`;
      markdown += `${techSections.overview}\n\n`;
    }
    if (techSections.specifications.length > 0) {
      markdown += `## ⚙️ Specifications\n\n`;
      techSections.specifications.forEach(spec => {
        markdown += `### ${spec.title}\n\n`;
        markdown += `${spec.content}\n\n`;
      });
    }
    if (techSections.codeExamples.length > 0) {
      markdown += `## 💻 Code Examples\n\n`;
      techSections.codeExamples.forEach(example => {
        markdown += `### ${example.title}\n\n`;
        markdown += `${example.description}\n\n`;
        markdown += `\`\`\`${example.language || 'text'}\n`;
        markdown += `${example.code}\n`;
        markdown += `\`\`\`\n\n`;
      });
    }
    if (techSections.apiReferences.length > 0) {
      markdown += `## 🔌 API References\n\n`;
      techSections.apiReferences.forEach(api => {
        markdown += `### ${api.method} ${api.endpoint}\n\n`;
        markdown += `${api.description}\n\n`;
        if (api.parameters) {
          markdown += `**Parameters:**\n`;
          api.parameters.forEach(param => {
            markdown += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
          });
          markdown += `\n`;
        }
      });
    }
    return markdown;
  }
  private generateResearchMarkdown(messages: any[], chatId: string, title?: string): string {
    const date = new Date().toLocaleDateString();
    let markdown = `# ${title || 'Research Summary'}\n\n`;
    markdown += `> **Research Date:** ${date}\n`;
    markdown += `> **Chat ID:** ${chatId.slice(-8)}\n\n`;
    const researchSections = this.extractResearchSections(messages);
    if (researchSections.question) {
      markdown += `## ❓ Research Question\n\n`;
      markdown += `${researchSections.question}\n\n`;
    }
    if (researchSections.methodology) {
      markdown += `## 🔬 Methodology\n\n`;
      markdown += `${researchSections.methodology}\n\n`;
    }
    if (researchSections.findings.length > 0) {
      markdown += `## 📊 Key Findings\n\n`;
      researchSections.findings.forEach((finding, index) => {
        markdown += `${index + 1}. ${finding}\n`;
      });
      markdown += `\n`;
    }
    if (researchSections.sources.length > 0) {
      markdown += `## 📚 Sources\n\n`;
      researchSections.sources.forEach(source => {
        markdown += `- [${source.title}](${source.url})\n`;
        if (source.description) {
          markdown += `  - ${source.description}\n`;
        }
      });
      markdown += `\n`;
    }
    if (researchSections.conclusions.length > 0) {
      markdown += `## 💡 Conclusions\n\n`;
      researchSections.conclusions.forEach(conclusion => {
        markdown += `- ${conclusion}\n`;
      });
      markdown += `\n`;
    }
    return markdown;
  }
  private extractPlanningSections(messages: any[]) {
    const sections = {
      objectives: [] as string[],
      analysis: [] as string[],
      steps: [] as string[],
      considerations: [] as string[],
      timeline: [] as string[]
    };
    messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const content = msg.content.toLowerCase();
        if (content.includes('objective') || content.includes('goal')) {
          sections.objectives.push(msg.content);
        }
        if (content.includes('step') || content.includes('action')) {
          sections.steps.push(msg.content);
        }
        if (content.includes('consider') || content.includes('risk')) {
          sections.considerations.push(msg.content);
        }
        if (content.includes('timeline') || content.includes('schedule')) {
          sections.timeline.push(msg.content);
        }
      }
    });
    return sections;
  }
  private extractCodeSections(messages: any[]) {
    const sections = {
      issues: [] as any[],
      improvements: [] as any[],
      bestPractices: [] as string[]
    };
    messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const content = msg.content;
        if (content.includes('```')) {
          sections.improvements.push({
            title: 'Code Improvement',
            description: 'Suggested code improvement',
            code: this.extractCodeFromMessage(content)
          });
        }
        if (content.toLowerCase().includes('issue') || content.toLowerCase().includes('bug')) {
          sections.issues.push({
            title: 'Code Issue',
            description: content,
            severity: 'medium',
            suggestion: 'Review and fix the identified issue'
          });
        }
      }
    });
    return sections;
  }
  private extractMeetingSections(messages: any[]) {
    const sections = {
      attendees: [] as string[],
      topics: [] as string[],
      decisions: [] as string[],
      actionItems: [] as any[]
    };
    messages.forEach(msg => {
      if (msg.role === 'user') {
        sections.attendees.push('User');
      }
      if (msg.role === 'assistant') {
        const content = msg.content.toLowerCase();
        if (content.includes('decid') || content.includes('agree')) {
          sections.decisions.push(msg.content);
        }
        if (content.includes('action') || content.includes('task')) {
          sections.actionItems.push({
            task: msg.content,
            assignee: 'Unassigned',
            dueDate: null
          });
        }
      }
    });
    return sections;
  }
  private extractTechnicalSections(messages: any[]) {
    const sections = {
      overview: '',
      specifications: [] as any[],
      codeExamples: [] as any[],
      apiReferences: [] as any[]
    };
    messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const content = msg.content;
        if (content.includes('```')) {
          sections.codeExamples.push({
            title: 'Code Example',
            description: 'Example implementation',
            code: this.extractCodeFromMessage(content),
            language: this.extractLanguageFromCode(content)
          });
        }
      }
    });
    return sections;
  }
  private extractResearchSections(messages: any[]) {
    const sections = {
      question: '',
      methodology: '',
      findings: [] as string[],
      sources: [] as any[],
      conclusions: [] as string[]
    };
    messages.forEach(msg => {
      if (msg.role === 'user' && !sections.question) {
        sections.question = msg.content;
      }
      if (msg.role === 'assistant') {
        const content = msg.content.toLowerCase();
        if (content.includes('finding') || content.includes('result')) {
          sections.findings.push(msg.content);
        }
        if (content.includes('conclusion') || content.includes('summary')) {
          sections.conclusions.push(msg.content);
        }
      }
    });
    return sections;
  }
  private extractCodeFromMessage(content: string): string {
    const codeBlockMatch = content.match(/```[\s\S]*?```/);
    return codeBlockMatch ? codeBlockMatch[0].replace(/```\w*/, '').replace(/```/, '').trim() : '';
  }
  private extractLanguageFromCode(content: string): string {
    const codeBlockMatch = content.match(/```(\w+)/);
    return codeBlockMatch ? codeBlockMatch[1] : 'text';
  }
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  private generateGistId(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
  getAvailableTemplates(): GistTemplate[] {
    return Array.from(this.templates.values());
  }
}
export const gistManager = new GistManager();
export type { ChatGist, GistContent, GistTemplate };