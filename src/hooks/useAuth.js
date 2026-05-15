import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'config_error')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return undefined
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser)
        setStatus(nextUser ? 'signed_in' : 'signed_out')
        setError('')
      },
      (nextError) => {
        console.error('Failed to watch authentication state.', nextError)
        setError('We could not verify your sign-in session. Please refresh and try again.')
        setStatus('signed_out')
      },
    )

    return unsubscribe
  }, [])

  const signIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase is not configured.')
    }

    setError('')
    await signInWithPopup(auth, googleProvider)
  }

  const logOut = async () => {
    if (!auth) {
      return
    }

    setError('')
    await signOut(auth)
  }

  return {
    user,
    status,
    error,
    signIn,
    logOut,
    isConfigured: isFirebaseConfigured,
  }
}
