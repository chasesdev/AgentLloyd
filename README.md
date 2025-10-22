# Z.AI Chat App

A React Native chat application for iOS that integrates with Z.AI's advanced AI models, including GLM-4.6, GLM-4.5V, and GLM-4.5-Air.

## Features

- **Multiple AI Models**: Support for GLM-4.6, GLM-4.5V (multimodal), and GLM-4.5-Air
- **Multimodal Support**: Send and analyze images with GLM-4.5V
- **Thinking Mode**: Enable reasoning display for supported models
- **Streaming Responses**: Real-time message streaming
- **Secure API Key Storage**: Secure storage for your Z.AI API key
- **iOS Optimized**: Designed specifically for iOS devices

## Supported Models

### GLM-4.6
- Latest flagship model with superior reasoning capabilities
- 200K context window
- Supports thinking mode
- Best for complex tasks and coding

### GLM-4.5V
- Visual reasoning model for images and videos
- Multimodal input support (text + images)
- Supports thinking mode
- Ideal for image analysis and GUI tasks

### GLM-4.5-Air
- Efficient model for everyday tasks
- Faster response times
- Lower token consumption
- Great for general conversations

## Getting Started

1. **Get your API key**:
   - Visit [Z.AI Open Platform](https://z.ai/model-api)
   - Register or login to your account
   - Navigate to API Keys section
   - Create and copy your API key

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the app**:
   ```bash
   npm run ios
   ```

4. **Enter your API key**:
   - Launch the app
   - Enter your Z.AI API key
   - The app will validate and save it securely

## Usage

### Sending Messages
- Type your message in the input field
- Tap the send button to get AI responses
- Responses stream in real-time

### Adding Images (GLM-4.5V only)
- Select GLM-4.5V model
- Tap the image icon
- Select an image from your photo library
- Add text description if needed
- Send to analyze the image

### Model Selection
- Tap the current model name in the header
- Select from available models
- Enable/disable thinking mode for supported models

### Thinking Mode
- Available for GLM-4.6 and GLM-4.5V
- Shows the model's reasoning process
- Toggle in model selection panel

## API Configuration

The app uses the Z.AI API with the following configuration:
- Base URL: `https://api.z.ai/api/paas/v4`
- Models: `glm-4.6`, `glm-4.5v`, `glm-4.5-air`
- Streaming support enabled
- Thinking mode configurable

## Development

### Project Structure
```
src/
├── components/     # Reusable UI components
├── screens/       # Main app screens
├── services/      # API and business logic
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

### Key Files
- `App.tsx` - Main app component
- `src/screens/ApiKeyScreen.tsx` - API key input screen
- `src/screens/ChatScreen.tsx` - Main chat interface
- `src/services/zaiService.ts` - Z.AI API integration

## Requirements

- iOS 13.0+
- React Native 0.76+
- Expo SDK 52
- Z.AI API key

## License

This project is for demonstration purposes. Please ensure you have proper licensing for all dependencies and comply with Z.AI's terms of service.
