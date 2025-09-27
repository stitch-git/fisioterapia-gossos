// components/common/Footer.jsx
import React, { useState } from 'react'
import TermsModal from './TermsModal'

export default function Footer() {
  const [showTermsModal, setShowTermsModal] = useState(false)

  return (
    <>
      <footer 
        className="py-3 border-t border-gray-200 mt-auto"
        style={{ backgroundColor: '#355F92' }}
      >
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center">
            <button
              onClick={() => setShowTermsModal(true)}
              className="text-white text-sm hover:text-blue-100 transition-colors duration-200 underline underline-offset-2 hover:underline-offset-4"
            >
              Términos y condiciones
            </button>
          </div>
        </div>
      </footer>

      {/* Modal de Términos y Condiciones */}
      <TermsModal 
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  )
}