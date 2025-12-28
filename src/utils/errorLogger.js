import { supabase } from '../lib/supabase'

export const logError = async ({
  errorType,
  errorMessage,
  errorCode = null,
  component,
  stackTrace = null,
  additionalData = null
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const logData = {
      user_id: user?.id || null,
      user_email: user?.email || null,
      error_type: errorType,
      error_message: errorMessage,
      error_code: errorCode,
      component: component,
      stack_trace: stackTrace,
      user_agent: navigator.userAgent,
      additional_data: additionalData
    }

    console.error('🔴 Error logged:', logData)

    await supabase.from('error_logs').insert([logData])
    
  } catch (err) {
    console.error('❌ Error logging system failed:', err)
  }
}

export default logError