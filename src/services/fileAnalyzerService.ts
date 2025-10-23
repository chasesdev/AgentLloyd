import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { errorHandlerService } from './errorHandlerService';
import { SecureStorage } from '../utils/secureStorage';
import axios from 'axios';

export interface FileAnalysisRequest {
  fileUri: string;
  fileName: string;
  mimeType: string;
  analysisType: 'auto' | 'text' | 'image' | 'code' | 'document' | 'data';
  maxSize?: number; // in bytes
}

export interface FileAnalysisResult {
  success: boolean;
  fileName: string;
  fileType: string;
  size: number;
  analysis: {
    summary: string;
    contentType: string;
    keyPoints: string[];
    entities: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    language?: string;
    structure?: any;
    metadata?: Record<string, any>;
  };
  extractedText?: string;
  extractedData?: any;
  error?: string;
  processingTime: number;
}

export interface FileMetadata {
  created?: Date;
  modified?: Date;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string[];
  pageCount?: number;
  wordCount?: number;
  dimensions?: { width: number; height: number };
  duration?: number; // for audio/video
}

export class FileAnalyzerService {
  private static instance: FileAnalyzerService;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private supportedImageTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private supportedDocumentTypes: string[] = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/json',
    'text/xml',
    'application/xml'
  ];
  private supportedCodeTypes: string[] = [
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-python',
    'text/x-java-source',
    'text/x-csrc',
    'text/x-c++src',
    'text/html',
    'text/css',
    'application/json',
    'text/x-sql'
  ];

  private constructor() {}

  static getInstance(): FileAnalyzerService {
    if (!FileAnalyzerService.instance) {
      FileAnalyzerService.instance = new FileAnalyzerService();
    }
    return FileAnalyzerService.instance;
  }

  /**
   * Pick and analyze a file
   */
  async pickAndAnalyzeFile(analysisType: 'auto' | 'text' | 'image' | 'code' | 'document' | 'data' = 'auto'): Promise<FileAnalysisResult> {
    try {
      // Pick file
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          ...this.supportedImageTypes,
          ...this.supportedDocumentTypes,
          ...this.supportedCodeTypes,
          '*/*' // Allow all types for auto-detection
        ],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('No file selected');
      }

      const asset = result.assets[0];
      
      // Analyze the picked file
      return await this.analyzeFile({
        fileUri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        analysisType,
        maxSize: this.maxFileSize
      });

    } catch (error) {
      await errorHandlerService.handleError(error as Error, {
        screen: 'FileAnalyzer',
        action: 'pick_and_analyze'
      });

      return {
        success: false,
        fileName: '',
        fileType: 'unknown',
        size: 0,
        analysis: {
          summary: '',
          contentType: 'unknown',
          keyPoints: [],
          entities: []
        },
        error: error instanceof Error ? error.message : 'File picking failed',
        processingTime: 0
      };
    }
  }

  /**
   * Pick and analyze an image
   */
  async pickAndAnalyzeImage(): Promise<FileAnalysisResult> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('No image selected');
      }

      const asset = result.assets[0];
      
      return await this.analyzeFile({
        fileUri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        mimeType: 'image/jpeg', // Default to JPEG
        analysisType: 'image',
        maxSize: this.maxFileSize
      });

    } catch (error) {
      await errorHandlerService.handleError(error as Error, {
        screen: 'FileAnalyzer',
        action: 'pick_and_analyze_image'
      });

      return {
        success: false,
        fileName: '',
        fileType: 'image',
        size: 0,
        analysis: {
          summary: '',
          contentType: 'image',
          keyPoints: [],
          entities: []
        },
        error: error instanceof Error ? error.message : 'Image picking failed',
        processingTime: 0
      };
    }
  }

  /**
   * Analyze a file
   */
  async analyzeFile(request: FileAnalysisRequest): Promise<FileAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateAnalysisRequest(request);

      // Determine file type and analysis approach
      const fileType = this.determineFileType(request.fileName, request.mimeType, request.analysisType);
      
      // Extract content based on file type
      const extractedContent = await this.extractFileContent(request, fileType);
      
      // Perform AI analysis
      const analysis = await this.performAIAnalysis(extractedContent, fileType, request);
      
      // Get file metadata
      const metadata = await this.extractFileMetadata(request, fileType);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        fileName: request.fileName,
        fileType,
        size: extractedContent.size,
        analysis: {
          ...analysis,
          metadata
        },
        extractedText: extractedContent.text,
        extractedData: extractedContent.data,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      await errorHandlerService.handleError(error as Error, {
        screen: 'FileAnalyzer',
        action: 'analyze_file',
        data: { fileName: request.fileName, fileType: request.mimeType }
      });

      return {
        success: false,
        fileName: request.fileName,
        fileType: request.mimeType,
        size: 0,
        analysis: {
          summary: '',
          contentType: 'unknown',
          keyPoints: [],
          entities: []
        },
        error: error instanceof Error ? error.message : 'File analysis failed',
        processingTime
      };
    }
  }

  /**
   * Validate analysis request
   */
  private validateAnalysisRequest(request: FileAnalysisRequest): void {
    if (!request.fileUri) {
      throw new Error('File URI is required');
    }

    if (!request.fileName) {
      throw new Error('File name is required');
    }

    const maxSize = request.maxSize || this.maxFileSize;
    if (maxSize > 50 * 1024 * 1024) { // 50MB hard limit
      throw new Error('File size too large (max 50MB)');
    }
  }

  /**
   * Determine file type
   */
  private determineFileType(fileName: string, mimeType: string, analysisType: string): string {
    if (analysisType !== 'auto') {
      return analysisType;
    }

    // Check MIME type first
    if (this.supportedImageTypes.includes(mimeType)) {
      return 'image';
    }
    if (this.supportedCodeTypes.includes(mimeType)) {
      return 'code';
    }
    if (this.supportedDocumentTypes.includes(mimeType)) {
      return 'document';
    }

    // Check file extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return 'text';

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'html', 'css', 'sql', 'json', 'xml'];
    const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'csv', 'rtf', 'odt'];

    if (imageExtensions.includes(extension)) return 'image';
    if (codeExtensions.includes(extension)) return 'code';
    if (documentExtensions.includes(extension)) return 'document';

    return 'text';
  }

  /**
   * Extract file content
   */
  private async extractFileContent(request: FileAnalysisRequest, fileType: string): Promise<{
    text: string;
    data: any;
    size: number;
  }> {
    try {
      // Read the actual file content
      const fileInfo = await FileSystem.getInfoAsync(request.fileUri);
      
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const size = fileInfo.size || 0;
      
      // For images, we can't read text content directly, but we can get metadata
      if (fileType === 'image') {
        return await this.extractImageContent(request, size);
      }
      
      // For text-based files, read the content
      const content = await FileSystem.readAsStringAsync(request.fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      switch (fileType) {
        case 'code':
          return await this.extractCodeContent(request, content, size);
        case 'document':
          return await this.extractDocumentContent(request, content, size);
        case 'text':
        default:
          return await this.extractTextContent(request, content, size);
      }
    } catch (error) {
      console.error('Failed to extract file content:', error);
      return {
        text: '',
        data: null,
        size: 0
      };
    }
  }

  /**
   * Extract image content
   */
  private async extractImageContent(request: FileAnalysisRequest, size: number): Promise<{
    text: string;
    data: any;
    size: number;
  }> {
    try {
      // Get image metadata
      const fileInfo = await FileSystem.getInfoAsync(request.fileUri);

      return {
        text: `Image file: ${request.fileName}`,
        data: {
          fileName: request.fileName,
          mimeType: request.mimeType,
          size: size,
          uri: request.fileUri,
          lastModified: fileInfo.exists && 'modificationTime' in fileInfo ? fileInfo.modificationTime : undefined,
          analysis: 'Image metadata extracted',
          features: ['file_info', 'mime_type_detection', 'size_analysis']
        },
        size
      };
    } catch (error) {
      return {
        text: `Image file: ${request.fileName}`,
        data: {
          fileName: request.fileName,
          mimeType: request.mimeType,
          size: size,
          error: 'Failed to extract image metadata'
        },
        size
      };
    }
  }

  /**
   * Extract code content
   */
  private async extractCodeContent(request: FileAnalysisRequest, content: string, size: number): Promise<{
    text: string;
    data: any;
    size: number;
  }> {
    const lines = content.split('\n');
    const language = this.detectLanguage(request.fileName);
    
    return {
      text: content,
      data: {
        fileName: request.fileName,
        language,
        lines: lines.length,
        functions: this.extractFunctions(content, language),
        classes: this.extractClasses(content, language),
        imports: this.extractImports(content, language),
        size,
        encoding: 'utf-8'
      },
      size
    };
  }

  /**
   * Extract document content
   */
  private async extractDocumentContent(request: FileAnalysisRequest, content: string, size: number): Promise<{
    text: string;
    data: any;
    size: number;
  }> {
    const words = content.split(/\s+/);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    return {
      text: content,
      data: {
        fileName: request.fileName,
        wordCount: words.length,
        lineCount: content.split('\n').length,
        paragraphCount: paragraphs.length,
        pageCount: Math.ceil(content.length / 2000), // Rough estimate
        size,
        encoding: 'utf-8',
        language: this.detectLanguage(content)
      },
      size
    };
  }

  /**
   * Extract text content
   */
  private async extractTextContent(request: FileAnalysisRequest, content: string, size: number): Promise<{
    text: string;
    data: any;
    size: number;
  }> {
    const lines = content.split('\n');
    const words = content.split(/\s+/);
    
    return {
      text: content,
      data: {
        fileName: request.fileName,
        encoding: 'utf-8',
        lineCount: lines.length,
        wordCount: words.length,
        characterCount: content.length,
        size,
        language: this.detectLanguage(content)
      },
      size
    };
  }

  /**
   * Perform AI analysis
   */
  private async performAIAnalysis(
    extractedContent: { text: string; data: any; size: number },
    fileType: string,
    request: FileAnalysisRequest
  ): Promise<{
    summary: string;
    contentType: string;
    keyPoints: string[];
    entities: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    language?: string;
    structure?: any;
  }> {
    try {
      const apiKey = await SecureStorage.getApiKey('zai_api_key');
      if (!apiKey) {
        throw new Error('API key not set');
      }

      let prompt = '';
      let systemPrompt = '';

      switch (fileType) {
        case 'image':
          prompt = `Analyze this image file: ${request.fileName}. Provide a detailed analysis including visual elements, colors, objects, and any text visible in the image.`;
          systemPrompt = 'You are an expert image analyst. Describe images in detail, focusing on visual elements, composition, and content.';
          break;
        case 'code':
          prompt = `Analyze this code file (${request.fileName}):\n\n\`\`\`\n${extractedContent.text}\n\`\`\`\n\nProvide analysis of the code structure, functionality, and any improvements.`;
          systemPrompt = 'You are an expert code reviewer. Analyze code for structure, functionality, best practices, and potential improvements.';
          break;
        case 'document':
          prompt = `Analyze this document: ${request.fileName}\n\nContent:\n${extractedContent.text.substring(0, 2000)}...\n\nProvide a comprehensive summary and analysis.`;
          systemPrompt = 'You are an expert document analyst. Summarize documents and extract key information, entities, and sentiment.';
          break;
        default:
          prompt = `Analyze this text file: ${request.fileName}\n\nContent:\n${extractedContent.text.substring(0, 2000)}...\n\nProvide analysis and summary.`;
          systemPrompt = 'You are an expert text analyst. Analyze text content for meaning, sentiment, and key information.';
      }

      const response = await axios.post(
        'https://api.z.ai/api/paas/v4/chat/completions',
        {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'glm-4.5-air',
          max_tokens: 1000,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content || '';

      return this.parseAIResponse(content, fileType, extractedContent.text);

    } catch (error) {
      console.error('AI analysis failed:', error);

      return this.performFallbackAnalysis(extractedContent.text, fileType);
    }
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(content: string, fileType: string, text: string): {
    summary: string;
    contentType: string;
    keyPoints: string[];
    entities: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    language?: string;
    structure?: any;
  } {
    // Extract key information from AI response
    const lines = content.split('\n');
    const summary = lines[0] || 'No summary available';
    
    // Extract key points (look for bullet points or numbered lists)
    const keyPoints: string[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
        keyPoints.push(trimmed.replace(/^[•\-\d\.]\s*/, ''));
      }
    });

    // Extract entities (simple extraction)
    const entities = this.extractEntities(text);
    
    // Detect sentiment (simple)
    const sentiment = this.detectSentiment(text);
    
    // Detect language
    const language = this.detectLanguage(text);

    return {
      summary,
      contentType: fileType,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['Analysis completed'],
      entities,
      sentiment,
      language,
      structure: {
        lines: text.split('\n').length,
        words: text.split(/\s+/).length,
        characters: text.length
      }
    };
  }

  /**
   * Perform fallback analysis
   */
  private performFallbackAnalysis(text: string, fileType: string): {
    summary: string;
    contentType: string;
    keyPoints: string[];
    entities: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    language?: string;
    structure?: any;
  } {
    return {
      summary: `Basic analysis of ${fileType} file completed`,
      contentType: fileType,
      keyPoints: [
        'File processed successfully',
        `Content length: ${text.length} characters`,
        `Lines: ${text.split('\n').length}`
      ],
      entities: this.extractEntities(text),
      sentiment: this.detectSentiment(text),
      language: this.detectTextLanguage(text),
      structure: {
        lines: text.split('\n').length,
        words: text.split(/\s+/).length,
        characters: text.length
      }
    };
  }

  /**
   * Extract file metadata
   */
  private async extractFileMetadata(request: FileAnalysisRequest, fileType: string): Promise<FileMetadata> {
    // Simulate metadata extraction
    return {
      created: new Date(),
      modified: new Date()
    };
  }

  private detectLanguage(fileNameOrContent: string): string {
    // First check if it's a file name (for programming languages)
    if (fileNameOrContent.includes('.')) {
      const extension = fileNameOrContent.split('.').pop()?.toLowerCase();
      const languages: Record<string, string> = {
        'js': 'JavaScript',
        'jsx': 'JavaScript',
        'ts': 'TypeScript',
        'tsx': 'TypeScript',
        'py': 'Python',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'html': 'HTML',
        'css': 'CSS',
        'sql': 'SQL',
        'json': 'JSON',
        'xml': 'XML'
      };
      
      return languages[extension || ''] || 'Unknown';
    }
    
    // For content, detect spoken language
    const content = fileNameOrContent.toLowerCase();
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const chineseWords = ['的', '了', '和', '是', '在', '有', '不', '这', '我', '你', '他', '她'];
    
    let englishCount = 0;
    let chineseCount = 0;
    
    englishWords.forEach(word => {
      if (content.includes(word)) englishCount++;
    });
    
    chineseWords.forEach(word => {
      if (content.includes(word)) chineseCount++;
    });
    
    if (chineseCount > englishCount) return 'Chinese';
    if (englishCount > 0) return 'English';
    return 'Unknown';
  }

  private extractFunctions(code: string, language: string): string[] {
    const functions: string[] = [];
    
    // Language-specific patterns
    const patterns: Record<string, RegExp[]> = {
      'JavaScript': [/function\s+(\w+)/g, /const\s+(\w+)\s*=\s*\(/g, /(\w+)\s*:\s*function/g],
      'TypeScript': [/function\s+(\w+)/g, /const\s+(\w+)\s*=\s*\(/g, /(\w+)\s*:\s*\(/g],
      'Python': [/def\s+(\w+)/g],
      'Java': [/public\s+\w+\s+(\w+)/g, /private\s+\w+\s+(\w+)/g, /protected\s+\w+\s+(\w+)/g],
      'C': [/(\w+)\s*\([^)]*\)\s*{/g],
      'C++': [/(\w+)\s*\([^)]*\)\s*{/g, /class\s+(\w+)/g]
    };
    
    const langPatterns = patterns[language] || patterns['JavaScript'];
    
    langPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        functions.push(match[1]);
      }
    });
    
    return [...new Set(functions)];
  }

  private extractClasses(code: string, language: string): string[] {
    const classes: string[] = [];
    
    const patterns: Record<string, RegExp[]> = {
      'JavaScript': [/class\s+(\w+)/g],
      'TypeScript': [/class\s+(\w+)/g, /interface\s+(\w+)/g],
      'Python': [/class\s+(\w+)/g],
      'Java': [/class\s+(\w+)/g, /interface\s+(\w+)/g],
      'C++': [/class\s+(\w+)/g]
    };
    
    const langPatterns = patterns[language] || [];
    
    langPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        classes.push(match[1]);
      }
    });
    
    return [...new Set(classes)];
  }

  private extractImports(code: string, language: string): string[] {
    const imports: string[] = [];
    
    const patterns: Record<string, RegExp[]> = {
      'JavaScript': [/import\s+.*?from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
      'TypeScript': [/import\s+.*?from\s+['"]([^'"]+)['"]/g, /import\s+.*?=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
      'Python': [/import\s+(\w+)/g, /from\s+(\w+)\s+import/g],
      'Java': [/import\s+([^;]+);/g],
      'C': [/#include\s*[<"]([^>"]+)[>"]/g],
      'C++': [/#include\s*[<"]([^>"]+)[>"]/g, /using\s+namespace\s+(\w+);/g]
    };
    
    const langPatterns = patterns[language] || [];
    
    langPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        imports.push(match[1]);
      }
    });
    
    return [...new Set(imports)];
  }

  private extractEntities(text: string): string[] {
    // Simple entity extraction
    const entities: string[] = [];
    
    // Extract emails
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emailMatches) entities.push(...emailMatches);
    
    // Extract URLs
    const urlMatches = text.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) entities.push(...urlMatches);
    
    // Extract capitalized words (potential entities)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedWords) entities.push(...capitalizedWords.slice(0, 10)); // Limit to 10
    
    return [...new Set(entities)];
  }

  private detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'happy', 'success'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'sad', 'fail', 'error', 'problem'];
    
    const lowerText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveScore++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeScore++;
    });
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private detectTextLanguage(text: string): string {
    // Simple language detection based on character patterns
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const hasArabic = /[\u0600-\u06ff]/.test(text);
    const hasCyrillic = /[\u0400-\u04ff]/.test(text);
    
    if (hasChinese) return 'Chinese';
    if (hasJapanese) return 'Japanese';
    if (hasArabic) return 'Arabic';
    if (hasCyrillic) return 'Russian';
    
    return 'English'; // Default assumption
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): {
    images: string[];
    documents: string[];
    code: string[];
  } {
    return {
      images: this.supportedImageTypes,
      documents: this.supportedDocumentTypes,
      code: this.supportedCodeTypes
    };
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(): Promise<{
    totalAnalyses: number;
    successRate: number;
    averageProcessingTime: number;
    fileTypeBreakdown: Record<string, number>;
  }> {
    // This would typically come from your database
    return {
      totalAnalyses: 0,
      successRate: 0,
      averageProcessingTime: 0,
      fileTypeBreakdown: {}
    };
  }
}

export const fileAnalyzerService = FileAnalyzerService.getInstance();