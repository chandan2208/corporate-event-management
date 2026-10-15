import { useRef } from 'react';

const LENGTH = 6;

/**
 * Six single-digit boxes for the email verification code (Phase 15).
 * - digits only (non-digits are ignored)
 * - typing advances, Backspace on an empty box goes back
 * - pasting "123456" (or "123 456") anywhere fills every box
 * - autoComplete="one-time-code" lets mobile keyboards offer the code
 *
 * `value` is a string of 0–6 digits; `onChange` receives the new string.
 */
function VerificationCodeInput({ value, onChange, disabled = false, hasError = false, autoFocus = false }) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || '');

  const focusBox = (index) => {
    const box = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))];
    if (box) {
      box.focus();
      box.select();
    }
  };

  const setDigitsFrom = (startIndex, incoming) => {
    const clean = incoming.replace(/\D/g, '');
    if (!clean) return;
    const next = digits.slice();
    let cursor = startIndex;
    for (const ch of clean) {
      if (cursor >= LENGTH) break;
      next[cursor] = ch;
      cursor += 1;
    }
    onChange(next.join('').slice(0, LENGTH));
    focusBox(cursor);
  };

  const handleChange = (index) => (e) => {
    const raw = e.target.value;
    if (raw === '') {
      const next = digits.slice();
      next[index] = '';
      onChange(next.join(''));
      return;
    }
    setDigitsFrom(index, raw.slice(-LENGTH));
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      const next = digits.slice();
      next[index - 1] = '';
      onChange(next.join(''));
      focusBox(index - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index) => (e) => {
    e.preventDefault();
    setDigitsFrom(index, e.clipboardData.getData('text'));
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((digit, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste(i)}
          onFocus={(e) => e.target.select()}
          className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-semibold text-slate-800 rounded-lg border
            bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:bg-slate-50 disabled:text-slate-400
            ${hasError ? 'border-red-400' : 'border-slate-300'}`}
        />
      ))}
    </div>
  );
}

export default VerificationCodeInput;
