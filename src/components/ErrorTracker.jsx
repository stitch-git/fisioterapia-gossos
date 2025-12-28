// ✅ NUEVO: Componente que escucha errores globalmente
import { useEffect } from 'react'
import { useErrorTracking } from '../hooks/useErrorTracking'

export default function ErrorTracker() {
  const { captureError } = useErrorTracking()

  useEffect(() => {
    const handleCaptureError = (event) => {
      const { message, context } = event.detail
      captureError(message, context)
    }

    window.addEventListener('captureUserError', handleCaptureError)

    return () => {
      window.removeEventListener('captureUserError', handleCaptureError)
    }
  }, [captureError])

  return null // No renderiza nada
}