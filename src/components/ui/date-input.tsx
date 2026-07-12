import * as React from "react";
import { Input } from "@/components/ui/input";

function formatDateDigits(digits: string) {
  const d = digits.slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join(".");
}

interface DateInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Поле ввода даты в формате дд.мм.гггг — точки расставляются автоматически,
 * пользователю нужно вводить только цифры.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, placeholder = "дд.мм.гггг", ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      onChange(formatDateDigits(digits));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        const target = e.target as HTMLInputElement;
        if (target.value.endsWith(".") && target.selectionStart === target.value.length) {
          e.preventDefault();
          onChange(formatDateDigits(value.replace(/\D/g, "").slice(0, -1)));
        }
      }
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={10}
        {...props}
      />
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
