import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { SUPPORT_STATUSES } from '../lib/support';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

/**
 * Hisobga oid jonli xabarlar: murojaatga javob, ustani tasdiqlash natijasi, komissiya hisobi
 */
export default function AccountEvents() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const onSupport = ({ number, status }) => {
      const label = SUPPORT_STATUSES[status]?.label;
      toast.info(t('Murojaat #{number}: {status}', { number, status: label ? t(label).toLowerCase() : status }));
    };
    const onVerification = ({ status, note }) => {
      if (status === 'verified') toast.success(t('Pasportingiz tasdiqlandi: profilingizda ✓ «Tasdiqlangan» belgisi paydo bo\'ldi'));
      else toast.error(t('Profilingiz hali tasdiqlanmadi: {note}', { note: note || '' }));
      refresh();
    };

    const onCommission = ({ message, blocked }) => {
      if (blocked) toast.error(message);
      else toast.info(message);
    };

    // Administrator ogohlantirishi (shikoyat bo'yicha): matn "Yordam" sahifasida ham saqlanadi
    const onWarning = ({ message }) => {
      toast.error(t('Administrator ogohlantirishi: {message}', { message }));
    };

    socket.on('support_updated', onSupport);
    socket.on('account_warning', onWarning);
    socket.on('verification_updated', onVerification);
    socket.on('commission_updated', onCommission);
    return () => {
      socket.off('support_updated', onSupport);
      socket.off('account_warning', onWarning);
      socket.off('verification_updated', onVerification);
      socket.off('commission_updated', onCommission);
    };
  }, [user?.id, refresh, toast]);

  return null;
}
