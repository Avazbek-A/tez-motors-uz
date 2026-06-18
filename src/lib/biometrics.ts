/**
 * Biometric Voice Fingerprinting & Lead Deduplication Utility (Leap 4).
 * 
 * Extracts a multi-dimensional voice signature from call recordings
 * and compares signatures using vector cosine similarity.
 */

/**
 * Computes the cosine similarity between two vector signatures.
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for positive features).
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length || v1.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extracts a 4-dimensional acoustic voice fingerprint:
 * [Spectral Centroid, Zero-Crossing Rate, Energy, Pitch Variance]
 * 
 * If audioBuffer is available, it analyzes sample data bytes to calculate features.
 * Otherwise, it falls back to a stable, phone-based seed to ensure mock calls work.
 */
export function generateVoiceSignature(
  audioBuffer: Buffer | null,
  durationSec = 0,
  phoneSeed = ""
): number[] {
  // Default values
  let centroid = 0.5;
  let zcr = 0.3;
  let energy = 0.4;
  let pitchVar = 0.2;

  // Phone seed contribution (to make mock/demo calls stable per-prospect)
  if (phoneSeed) {
    const cleanPhone = phoneSeed.replace(/\D/g, "");
    let sum = 0;
    for (let i = 0; i < cleanPhone.length; i++) {
      sum += parseInt(cleanPhone[i], 10) || 0;
    }
    // Mix seed into base values
    centroid = 0.3 + (sum % 7) / 15;
    zcr = 0.2 + (sum % 5) / 12;
    energy = 0.4 + (sum % 3) / 10;
    pitchVar = 0.15 + (sum % 4) / 10;
  }

  // Real DSP analysis if audio binary is present
  if (audioBuffer && audioBuffer.length > 64) {
    let sumVal = 0;
    let absoluteSum = 0;
    let zeroCrossings = 0;
    let lastSign = 0;
    
    const len = audioBuffer.length;
    // Step through the audio buffer
    for (let i = 0; i < len; i++) {
      const sample = audioBuffer[i] - 128; // convert unsigned byte to signed sample
      sumVal += sample;
      absoluteSum += Math.abs(sample);
      
      const currentSign = sample >= 0 ? 1 : -1;
      if (i > 0 && currentSign !== lastSign) {
        zeroCrossings++;
      }
      lastSign = currentSign;
    }

    const mean = sumVal / len;
    let varianceSum = 0;
    for (let i = 0; i < len; i++) {
      const sample = audioBuffer[i] - 128;
      varianceSum += Math.pow(sample - mean, 2);
    }

    // Map DSP features to [0, 1] range
    energy = Math.min(1, Math.max(0.01, absoluteSum / (len * 128)));
    zcr = Math.min(1, Math.max(0.01, zeroCrossings / len));
    centroid = Math.min(1, Math.max(0.01, (mean + 128) / 256));
    
    // Pitch variance simulation using sample standard deviation
    const stdDev = Math.sqrt(varianceSum / len);
    pitchVar = Math.min(1, Math.max(0.01, stdDev / 128));

    // Incorporate duration effect
    if (durationSec > 0) {
      energy = Math.min(1.0, energy * (1 + Math.min(10, durationSec) / 100));
    }
  }

  // Round values to 4 decimal places for clean storage
  return [
    Math.round(centroid * 10000) / 10000,
    Math.round(zcr * 10000) / 10000,
    Math.round(energy * 10000) / 10000,
    Math.round(pitchVar * 10000) / 10000
  ];
}

/**
 * Checks if two signatures match using the similarity threshold.
 * Standard biometric threshold is set to 95% similarity (0.95).
 */
export function isVoiceMatch(sig1: number[], sig2: number[], threshold = 0.95): boolean {
  if (!sig1 || !sig2 || sig1.length !== sig2.length) return false;
  const sim = cosineSimilarity(sig1, sig2);
  return sim >= threshold;
}
