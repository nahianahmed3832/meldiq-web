import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { useT } from "../../i18n";

/** One explicit, reversible reveal control. The value remains owned by the calling form. */
export function PasswordInput({ id: suppliedId, className = "input", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const t = useT();
  return (
    <div className="password-control">
      <input {...props} id={id} type={revealed ? "text" : "password"} className={className} />
      <button
        type="button"
        className="icon-btn password-reveal"
        aria-label={t(revealed ? "common.password.hide" : "common.password.show")}
        aria-pressed={revealed}
        aria-controls={id}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
