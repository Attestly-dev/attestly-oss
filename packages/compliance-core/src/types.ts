export interface AiManifest {
  /**
   * Allowed AI models. Must be version-locked (e.g., 'gpt-4-0613' instead of 'gpt-4').
   */
  allowedModels: string[];

  /**
   * Required metadata tags for traceability. These keys must be present in the request payload or headers.
   */
  requiredMetadata: string[];

  /**
   * PII scrubbing configuration.
   */
  piiScrubbing: {
    level: 'off' | 'standard' | 'strict';
    redactString?: string;
    customRegex?: string[];
  };

  /**
   * EU AI Act Risk Category classification.
   */
  euRiskCategory: 'minimal' | 'limited' | 'high' | 'gpai';

  /**
   * Use case context domain under the EU AI Act.
   */
  systemDomain: 'general' | 'law-enforcement' | 'education' | 'employment' | 'critical-infrastructure' | 'biometrics' | 'essential-services' | 'migration' | 'justice';

  /**
   * Flag for explicit prohibited practices under Article 5 of the EU AI Act.
   */
  prohibitedPractices?: {
    realTimeBiometrics?: boolean;
    socialScoring?: boolean;
    emotionRecognition?: boolean;
    manipulativeAI?: boolean;
    untargetedScraping?: boolean;
  };
}
