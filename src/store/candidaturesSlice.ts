import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type Decision = 'ACCEPTÉE' | 'REFUSÉE' | 'À REVOIR' | 'NON_LISIBLE'

export interface Candidature {
  id: string
  candidateName: string
  email: string
  subject: string
  date: string
  decision: Decision
  score?: number
  skills?: string
  experience?: string
  rawSummary?: string
  school?: string
  schoolType?: string
  phone?: string
  experienceCount?: number
  experienceDuration?: string
  experienceYearsAvg?: number
  lastEmployer?: string
  cvUrl?: string
  offerTitle?: string
  offerDescription?: string
}

interface CandidaturesState {
  items: Candidature[]
  filter: Decision | 'ALL'
}

const initialState: CandidaturesState = {
  items: [],
  filter: 'ALL',
}

const candidaturesSlice = createSlice({
  name: 'candidatures',
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<Decision | 'ALL'>) {
      state.filter = action.payload
    },
    setCandidatures(state, action: PayloadAction<Candidature[]>) {
      state.items = action.payload
    },
    addCandidature(state, action: PayloadAction<Candidature>) {
      state.items.unshift(action.payload)
    },
  },
})

export const { setFilter, setCandidatures, addCandidature } = candidaturesSlice.actions
export default candidaturesSlice.reducer
