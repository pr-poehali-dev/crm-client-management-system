import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDateDigits(digits: string) {
  const d = digits.slice(0, 8);
  let day = d.slice(0, 2);
  let month = d.slice(2, 4);
  const year = d.slice(4, 8);

  if (day.length === 2) {
    const dayNum = parseInt(day, 10);
    if (dayNum === 0) day = "01";
    else if (dayNum > 31) day = "31";
  }
  if (month.length === 2) {
    const monthNum = parseInt(month, 10);
    if (monthNum === 0) month = "01";
    else if (monthNum > 12) month = "12";
  }

  const parts = [day, month, year].filter(Boolean);
  return parts.join(".");
}

/** Проверяет, что дд.мм.гггг — реально существующая календарная дата (с учётом високосных лет). */
export function isValidDateString(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

interface DateInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Поле ввода даты в формате дд.мм.гггг — точки расставляются автоматически,
 * пользователю нужно вводить только цифры. Дополнительно ограничивает
 * день до 31, месяц до 12 и подсвечивает красным несуществующую дату
 * (например, 31.02).
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, placeholder = "дд.мм.гггг", className, ...props }, ref) => {
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

    const isInvalid = value.length === 10 && !isValidDateString(value);

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={10}
        aria-invalid={isInvalid}
        title={isInvalid ? "Такой даты не существует" : undefined}
        className={cn(isInvalid && "border-red-500 focus-visible:ring-red-500", className)}
        {...props}
      />
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };