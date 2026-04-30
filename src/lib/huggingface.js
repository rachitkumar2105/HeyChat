// src/lib/huggingface.js
// This file talks to Hugging Face AI to convert voice to text
// Like having a robot ear that types what you say!

const HF_TOKEN = process.env.REACT_APP_HF_TOKEN

export const transcribeAudio = async (audioBlob) => {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'audio/webm',
        },
        body: audioBlob,
      }
    )

    if (!response.ok) {
      throw new Error('Transcription failed')
    }

    const result = await response.json()
    return result.text || ''
  } catch (error) {
    console.error('Voice transcription error:', error)
    return ''
  }
}

export const moderateText = async (text) => {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/roberta-hate-speech-dynabench-r4-target',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    )

    const result = await response.json()
    // Returns true if content is safe
    if (Array.isArray(result) && result[0]) {
      const hateScore = result[0].find((r) => r.label === 'hate')?.score || 0
      return hateScore < 0.7 // Safe if hate score is low
    }
    return true
  } catch {
    return true // Allow if moderation fails
  }
}
