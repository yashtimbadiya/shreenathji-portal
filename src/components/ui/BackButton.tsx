import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEscapeBack } from '../../hooks/useEscapeBack';

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => (to ? navigate(to) : navigate(-1));

  // ESC key fires the same action as clicking the button
  useEscapeBack(handleBack);

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-charcoal hover:bg-surface"
      title="Back (Esc)"
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
