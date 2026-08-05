'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, XCircle } from 'lucide-react';
import { supportAPI } from '@/lib/api';
import { STORE } from '@/lib/config';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];
const EMOJIS = ['', '😞',   '😐',   '🙂',    '😊',        '😍'];

export default function SupportRatePage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [hover, setHover]       = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    supportAPI.getRatingPage(token)
      .then(r => setInfo(r.data))
      .catch(e => setError(e.response?.data?.detail || 'This rating link is invalid or has already been used.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (star: number) => {
    if (submitting || submitted) return;
    setSelected(star);
    setSubmitting(true);
    try {
      await supportAPI.submitTokenRating(token, { rating: star, comment: comment.trim() || undefined });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-maroon-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-maroon-800" />
    </div>
  );

  return (
    <div className="min-h-screen bg-maroon-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-maroon-900">{STORE.name}</h1>
          <p className="text-xs text-maroon-600 font-medium uppercase tracking-widest mt-1">{STORE.tagline}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-maroon-200 p-8 text-center">
          {error ? (
            /* Error / Already rated */
            <div>
              <XCircle size={48} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">Link Unavailable</h2>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          ) : submitted ? (
            /* Thank-you */
            <div>
              <div className="text-6xl mb-3">{EMOJIS[selected]}</div>
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-1">Thank you, {info?.customer_name?.split(' ')[0]}!</h2>
              <p className="text-gray-500 text-sm mb-4">Your feedback has been recorded and shared with our team.</p>
              <div className="flex justify-center gap-1 mb-2">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={28} fill={i <= selected ? '#facc15' : 'none'} className={i <= selected ? 'text-yellow-400' : 'text-gray-200'} />
                ))}
              </div>
              <p className="text-sm font-semibold text-maroon-700">{LABELS[selected]}</p>
            </div>
          ) : (
            /* Rating form */
            <div>
              <div className="w-16 h-16 bg-maroon-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⭐</div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">How was your experience?</h2>
              {info?.cs_name && (
                <p className="text-sm text-gray-500 mb-1">
                  You were helped by <span className="font-semibold text-maroon-700">{info.cs_name}</span>
                </p>
              )}
              {info?.issue_summary && (
                <p className="text-xs text-gray-400 mb-5">Topic: {info.issue_summary}</p>
              )}
              {!info?.issue_summary && <div className="mb-5" />}

              {/* Stars */}
              <div className="flex justify-center gap-3 mb-2">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleSubmit(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    disabled={submitting}
                    className="transition-all hover:scale-125 focus:outline-none disabled:opacity-50"
                  >
                    <Star
                      size={52}
                      fill={(hover || selected) >= star ? '#facc15' : 'none'}
                      className={(hover || selected) >= star ? 'text-yellow-400 drop-shadow' : 'text-gray-300'}
                    />
                  </button>
                ))}
              </div>

              <p className={`text-sm font-semibold h-5 mb-5 transition-all ${hover ? 'text-maroon-700' : 'text-gray-300'}`}>
                {hover ? `${EMOJIS[hover]} ${LABELS[hover]}` : 'Tap a star to rate'}
              </p>

              {/* Optional comment */}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Any additional feedback? (optional)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-maroon-400 focus:ring-1 focus:ring-maroon-200 bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-3">Tap any star to submit instantly</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} {STORE.name}</p>
      </div>
    </div>
  );
}
