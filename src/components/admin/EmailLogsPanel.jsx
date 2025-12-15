// src/components/admin/EmailLogsPanel.jsx
import React, { useState } from 'react'
import { useEmailLogs } from '../../hooks/useEmailLogs'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { es, ca } from 'date-fns/locale'

export default function EmailLogsPanel() {
  const { t, i18n } = useTranslation()
  const getDateLocale = () => i18n.language === 'ca' ? ca : es

  const [filters, setFilters] = useState({
    status: '',
    email_type: '',
    recipient_email: '',
    limit: 50
  })

  const { logs, stats, loading, retryFailedEmail } = useEmailLogs(filters)

  const getStatusBadge = (status) => {
    const badges = {
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getEmailTypeLabel = (type) => {
    const typeMap = {
      welcome: 'welcome',
      confirmation: 'confirmation',
      cancellation: 'cancellation',
      reminder: 'reminder',
      password_reset: 'passwordReset',
      password_changed: 'passwordChanged',
      admin_new_booking: 'adminNewBooking',
      admin_booking_cancelled: 'adminCancellation'
    }
    return t(`emailLogsPanel.emailTypes.${typeMap[type] || type}`)
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">{t('emailLogsPanel.stats.totalSent')}</div>
            <div className="text-2xl font-bold text-green-600">{stats.total_sent}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">{t('emailLogsPanel.stats.failed')}</div>
            <div className="text-2xl font-bold text-red-600">{stats.total_failed}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">{t('emailLogsPanel.stats.pending')}</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.total_pending}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">{t('emailLogsPanel.stats.successRate')}</div>
            <div className="text-2xl font-bold text-blue-600">{stats.success_rate}%</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('emailLogsPanel.filters.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input w-full"
            >
              <option value="">{t('emailLogsPanel.filters.all')}</option>
              <option value="sent">{t('emailLogsPanel.filters.sent')}</option>
              <option value="failed">{t('emailLogsPanel.stats.failed')}</option>
              <option value="pending">{t('emailLogsPanel.filters.pending')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('emailLogsPanel.filters.emailType')}</label>
            <select
              value={filters.email_type}
              onChange={(e) => setFilters({ ...filters, email_type: e.target.value })}
              className="input w-full"
            >
              <option value="">{t('emailLogsPanel.filters.all')}</option>
              <option value="confirmation">{t('emailLogsPanel.emailTypes.confirmation')}</option>
              <option value="cancellation">{t('emailLogsPanel.emailTypes.cancellation')}</option>
              <option value="reminder">{t('emailLogsPanel.emailTypes.reminder')}</option>
              <option value="admin_new_booking">{t('emailLogsPanel.emailTypes.adminNewBooking')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('emailLogsPanel.filters.recipientEmail')}</label>
            <input
              type="text"
              value={filters.recipient_email}
              onChange={(e) => setFilters({ ...filters, recipient_email: e.target.value })}
              placeholder={t('emailLogsPanel.filters.searchPlaceholder')}
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="loading-spinner mx-auto mb-2"></div>
            <p className="text-gray-600">{t('emailLogsPanel.loading')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t('emailLogsPanel.noLogsFound')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.type')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.recipient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.subject')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('emailLogsPanel.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getEmailTypeLabel(log.email_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{log.recipient_name || 'N/A'}</div>
                      <div className="text-gray-500">{log.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.subject}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(log.status)}`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.status === 'failed' && (
                        <button
                          onClick={() => retryFailedEmail(log.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {t('emailLogsPanel.table.retry')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}