import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const CONTROL_CLS =
  "w-full min-h-[44px] rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-paper placeholder:text-paper-mute focus:border-amber-brand focus:outline-none focus:ring-2 focus:ring-amber-brand/40 disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-sm font-semibold text-paper"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="mt-1.5 text-xs text-paper-mute">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, id, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className={CONTROL_CLS} {...rest} />
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, id, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        rows={4}
        className={`${CONTROL_CLS} min-h-[110px] resize-y py-3 leading-relaxed`}
        {...rest}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
};

export function Select({
  label,
  hint,
  error,
  id,
  options,
  ...rest
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} className={`${CONTROL_CLS} bg-ink-800`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-800">
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
