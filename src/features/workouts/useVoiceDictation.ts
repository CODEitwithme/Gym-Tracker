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

export function getSpeechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as IWindow
  return win.SpeechRecognition || win.webkitSpeechRecognition || null
}

export function useVoiceDictation(onTranscript: (newText: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported] = useState(() => Boolean(getSpeechConstructor()))
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isExplicitStopRef = useRef(false)

  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const stopListening = useCallback(() => {
    isExplicitStopRef.current = true
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    }
  }, [])

  const startListening = useCallback(() => {
    const SpeechConstructor = getSpeechConstructor()

    if (!SpeechConstructor) {
      setError(
        'Voice dictation is not supported in this browser. Chrome, Edge, and Safari are supported, or you can use your device keyboard dictation.',
      )
      setIsListening(false)
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

      isExplicitStopRef.current = false
      const recognition = new SpeechConstructor()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results
        let accumulated = ''
        for (let i = event.resultIndex; i < results.length; i++) {
          const item = results[i]
          if (item) {
            accumulated += `${item[0]?.transcript ?? ''} `
          }
        }
        const trimmed = accumulated.trim()
        if (trimmed) {
          onTranscriptRef.current(trimmed)
        }
      }

      recognition.onerror = (event: { error: string }) => {
        if (isExplicitStopRef.current || event.error === 'aborted') {
          return
        }

        if (event.error === 'no-speech') {
          // Timeout with no speech detected - not a hard failure
        } else if (event.error === 'network') {
          setError(
            'Speech recognition network error. Chrome/Edge uses cloud services for speech; ensure you have an active internet connection (and disable any Brave shields or ad blockers blocking Google speech).',
          )
        } else if (event.error === 'not-allowed') {
          setError(
            'Microphone access was denied. Please click the lock or camera/mic icon in your browser address bar and set Microphone to "Allow".',
          )
        } else if (event.error === 'audio-capture') {
          setError('No microphone found. Please connect a working microphone and try again.')
        } else if (event.error === 'service-not-allowed') {
          setError('Speech recognition service is not permitted by this browser or network.')
        } else {
          setError(`Microphone error (${event.error}). Please try again or type manually.`)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (!errMsg.toLowerCase().includes('already started')) {
        setError(
          'Could not access microphone. Ensure microphone permissions are enabled in your browser settings.',
        )
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    error,
    clearError,
    toggleListening,
    startListening,
    stopListening,
  }
}


