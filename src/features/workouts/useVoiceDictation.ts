import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      [index: number]: {
        transcript: string
      }
    }
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface IWindow extends Window {
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  SpeechRecognition?: SpeechRecognitionConstructor
}

export function useVoiceDictation(onTranscript: (newText: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const win = window as unknown as IWindow
    const SpeechConstructor =
      win.SpeechRecognition || win.webkitSpeechRecognition
    setIsSupported(Boolean(SpeechConstructor))
  }, [])

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return
    const win = window as unknown as IWindow
    const SpeechConstructor =
      win.SpeechRecognition || win.webkitSpeechRecognition

    if (!SpeechConstructor) {
      setError(
        'Voice dictation is not supported in this browser. You can type or use your keyboard dictation.',
      )
      return
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore cleanup secondary failure
        }
      }

      const recognition = new SpeechConstructor()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results
        let accumulated = ''
        for (let i = event.resultIndex; i < results.length; i++) {
          if (results[i].isFinal) {
            accumulated += `${results[i][0].transcript} `
          }
        }
        if (accumulated.trim()) {
          onTranscript(accumulated.trim())
        }
      }

      recognition.onerror = (event: { error: string }) => {
        if (event.error === 'no-speech') {
          // Timeout with no speech detected
        } else if (event.error === 'network') {
          setError(
            'Voice recognition requires an active network connection in this browser. Please type or use your device keyboard dictation.',
          )
        } else if (event.error === 'not-allowed') {
          setError(
            'Microphone access was denied. Please grant microphone permissions in browser settings.',
          )
        } else {
          setError(`Mic error: ${event.error}`)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setError('Could not access microphone.')
      setIsListening(false)
    }
  }, [onTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isListening,
    isSupported,
    error,
    toggleListening,
    startListening,
    stopListening,
  }
}

