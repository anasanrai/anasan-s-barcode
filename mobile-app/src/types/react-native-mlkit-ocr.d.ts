// Type declarations for @react-native-ml-kit/text-recognition
// The package ships its own types in v2.0.0; this file is a fallback.
declare module '@react-native-ml-kit/text-recognition' {
  export interface TextRecognitionBlock {
    text: string;
    lines: Array<{
      text: string;
      elements: Array<{ text: string }>;
    }>;
  }

  export interface TextRecognitionResult {
    text: string;
    blocks: TextRecognitionBlock[];
  }

  const TextRecognition: {
    recognize(uri: string): Promise<TextRecognitionResult>;
  };

  export default TextRecognition;
}
