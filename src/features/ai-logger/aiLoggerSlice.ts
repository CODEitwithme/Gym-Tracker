import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import type { AiConversationTurn, ParsedWorkout } from './types'

export interface AiLoggerState {
  conversation: AiConversationTurn[]
  parsing: boolean
  parseError: string | null
  pendingWorkout: ParsedWorkout | null
  saving: boolean
  saveError: string | null
  savedMessage: string | null
}

const initialState: AiLoggerState = {
  conversation: [],
  parsing: false,
  parseError: null,
  pendingWorkout: null,
  saving: false,
  saveError: null,
  savedMessage: null,
}

export const aiLoggerSlice = createSlice({
  name: 'aiLogger',
  initialState,
  reducers: {
    addUserMessage: {
      reducer: (state, action: PayloadAction<string>) => {
        state.parseError = null
        state.savedMessage = null
        state.conversation.push({
          id: createUUID(),
          role: 'user',
          content: action.payload,
          timestamp: createTimestamp(),
        })
      },
      prepare: (content: string) => ({ payload: content }),
    },
    startParsing: (state) => {
      state.parsing = true
      state.parseError = null
      state.savedMessage = null
    },
    setParseResult: {
      reducer: (
        state,
        action: PayloadAction<{
          result: ParsedWorkout
          assistantMessage: string
        }>,
      ) => {
        state.parsing = false
        state.parseError = null
        state.pendingWorkout = action.payload.result
        state.conversation.push({
          id: createUUID(),
          role: 'assistant',
          content: action.payload.assistantMessage,
          parsedWorkout: action.payload.result,
          timestamp: createTimestamp(),
        })
      },
      prepare: (
        resultOrPayload:
          | ParsedWorkout
          | { result: ParsedWorkout; assistantMessage?: string },
        maybeAssistantMessage?: string,
      ) => {
        let result: ParsedWorkout
        let assistantMessage: string | undefined
        if ('result' in resultOrPayload) {
          result = resultOrPayload.result
          assistantMessage =
            resultOrPayload.assistantMessage ?? maybeAssistantMessage
        } else {
          result = resultOrPayload
          assistantMessage = maybeAssistantMessage
        }

        const defaultMsg = result.followUpQuestion
          ? `I parsed your workout, but I have a question: ${result.followUpQuestion}`
          : `I parsed: ${result.sets ? `${result.sets} sets of ` : ''}${result.exercise}${result.reps ? ` x ${result.reps} reps` : ''}${result.weight ? ` @ ${result.weight}${result.unit ?? 'kg'}` : ''}. Please review and confirm below.`

        return {
          payload: {
            result,
            assistantMessage: assistantMessage ?? defaultMsg,
          },
        }
      },
    },
    setParseError: (state, action: PayloadAction<string>) => {
      state.parsing = false
      state.parseError = action.payload
    },
    clearPendingWorkout: (state) => {
      state.pendingWorkout = null
    },
    startSaving: (state) => {
      state.saving = true
      state.saveError = null
    },
    setSaveSuccess: (state, action: PayloadAction<string>) => {
      state.saving = false
      state.saveError = null
      state.savedMessage = action.payload
      state.pendingWorkout = null
    },
    setSaveError: (state, action: PayloadAction<string>) => {
      state.saving = false
      state.saveError = action.payload
    },
    clearConversation: (state) => {
      state.conversation = []
      state.pendingWorkout = null
      state.parseError = null
      state.saveError = null
      state.savedMessage = null
    },
  },
})

export const {
  addUserMessage,
  startParsing,
  setParseResult,
  setParseError,
  clearPendingWorkout,
  startSaving,
  setSaveSuccess,
  setSaveError,
  clearConversation,
} = aiLoggerSlice.actions

export default aiLoggerSlice.reducer
