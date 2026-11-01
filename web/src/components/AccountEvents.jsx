import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { SUPPORT_STATUSES } from '../lib/support';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Hisobga oid jonli xabarlar: murojaatga javob, ustani tasdiqlash natijasi
 */
export default function AccountEvents() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const onSupport = ({ number, status }) => {
      toast.info(`Murojaat #${number}: ${SUPPORT_STATUSES[status]?.label.toLowerCase() || status}`);
    };
    const onVerification = ({ status, note }) => {
      if (status === 'verified') toast.success('Profilingiz tasdiqlandi! Endi ishga chiqishingiz mumkin');
      else toast.error(`Profilingiz hali tasdiqlanmadi: ${note}`);
      refresh();
    };

    socket.on('support_updated', onSupport);
    socket.on('verification_updated', onVerification);
    return () => {
      socket.off('support_updated', onSupport);
      socket.off('verification_updated', onVerification);
    };
  }, [user?.id, refresh, toast]);

  return null;
}
