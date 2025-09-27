// components/common/TermsModal.jsx
import React from 'react'

export default function TermsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200" style={{ backgroundColor: '#355F92' }}>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Términos y Condiciones
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          <div className="prose prose-sm sm:prose max-w-none text-gray-700 space-y-4">
            
            <div className="text-center mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                TÉRMINOS Y CONDICIONES DE USO
              </h3>
              <p className="text-base font-semibold text-gray-800">
                SISTEMA DE RESERVAS DE FISIOTERAPIA GOSSOS
              </p>
            </div>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                1. ACEPTACIÓN DE TÉRMINOS
              </h4>
              <p className="text-sm sm:text-base leading-relaxed">
                Al acceder y utilizar el sistema de reservas en línea de Fisioterapia Gossos (en adelante, <strong>"el Servicio"</strong>), usted (el/la usuario/a) acepta cumplir estos Términos y Condiciones. Si no está de acuerdo con algún punto, por favor, no utilice el Servicio.
              </p>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                2. USO DEL SERVICIO
              </h4>
              <p className="text-sm sm:text-base leading-relaxed mb-2">
                El Servicio permite reservar sesiones de fisioterapia y/o hidroterapia para perros.
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                <li>El usuario se compromete a proporcionar datos verídicos y actualizados.</li>
                <li>Las reservas son personales y no pueden ser transferidas a terceros sin autorización.</li>
                <li>El Servicio no puede ser utilizado con fines fraudulentos o ilegales.</li>
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                3. POLÍTICA DE RESERVAS Y CANCELACIONES
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                <li>Las reservas se consideran confirmadas una vez reciba el correo o mensaje de confirmación.</li>
                <li>
                  <strong className="text-red-600">
                    Las cancelaciones deben realizarse con un mínimo de 24 horas de antelación. Cancelaciones fuera de este plazo pueden conllevar el cobro parcial o total de la sesión.
                  </strong>
                </li>
                <li>En caso de retraso, se podrá reducir el tiempo de la sesión sin ajuste del precio.</li>
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                4. RESPONSABILIDADES
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                <li>Fisioterapia Gossos se compromete a prestar el servicio con profesionalidad y a garantizar la seguridad del animal dentro de las instalaciones.</li>
                <li>El usuario es responsable del estado de salud del perro y debe informar previamente de cualquier condición médica relevante.</li>
                <li>El centro no se hace responsable de lesiones o incidentes derivados de datos incorrectos u omisiones en la información facilitada por el usuario.</li>
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                5. PROTECCIÓN DE DATOS
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                <li>Los datos personales recogidos (nombre, teléfono, email, datos del animal) se tratarán de acuerdo con el <strong>Reglamento (UE) 2016/679 (RGPD)</strong> y la <strong>LOPDGDD</strong>.</li>
                <li>
                  El usuario puede ejercer sus derechos de acceso, rectificación, supresión, oposición y portabilidad enviando una solicitud a{' '}
                  <a 
                    href="mailto:info@fisioterapiagossos.com"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    info@fisioterapiagossos.com
                  </a>.
                </li>
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                6. MODIFICACIONES
              </h4>
              <p className="text-sm sm:text-base leading-relaxed">
                Fisioterapia Gossos se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor en el momento de su publicación en el sitio web o plataforma de reservas.
              </p>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                7. CONTACTO
              </h4>
              <p className="text-sm sm:text-base leading-relaxed mb-2">
                Para cualquier duda o reclamación sobre estos Términos y Condiciones, puede contactarnos en:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                  <li>
                    <strong>Correo electrónico:</strong>{' '}
                    <a 
                      href="mailto:info@fisioterapiagossos.com"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      info@fisioterapiagossos.com
                    </a>
                  </li>
                  <li>
                    <strong>Teléfono:</strong>{' '}
                    <a 
                      href="tel:+34676262863"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      676 26 28 63
                    </a>
                  </li>
                </ul>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="btn btn-primary"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}