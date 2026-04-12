import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    handleAuthCallback()
  }, [])

  const handleAuthCallback = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error

      if (session) {
        setStatus('success')
        setMessage('✅ Email verified successfully!')
        setTimeout(() => {
          checkOnboardingStatus(session.user.id)
        }, 2000)
      } else {
        setStatus('error')
        setMessage('❌ Verification failed. Please try again.')
      }
    } catch (error: any) {
      console.error('Auth callback error:', error)
      setStatus('error')
      setMessage('❌ Verification failed: ' + error.message)
    }
  }

  const checkOnboardingStatus = async (userId: string) => {
    try {
      const { data: ownerData } = await supabase
        .from('owners')
        .select('onboarding_completed')
        .eq('id', userId)
        .single()

      if (ownerData?.onboarding_completed) {
        navigate('/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Verifying Email...</h2>
            <p className="text-gray-600">Please wait while we confirm your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-4">Your email has been confirmed successfully.</p>
            <p className="text-sm text-gray-500">Redirecting you to setup...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
