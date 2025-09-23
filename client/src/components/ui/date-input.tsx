import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { parse, format, isValid } from "date-fns"

interface DateInputProps extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, placeholder = "MM/DD/YYYY", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")
    const [isValid_, setIsValid_] = React.useState(true)

    // Convert ISO date (YYYY-MM-DD) to display format (M/DD/YYYY)
    const formatDisplayValue = (isoDate: string): string => {
      if (!isoDate) return ""
      try {
        const date = parse(isoDate, "yyyy-MM-dd", new Date())
        if (isValid(date)) {
          return format(date, "M/d/yyyy")
        }
      } catch (error) {
        // If it's already in M/DD/YYYY format, return as is
        return isoDate
      }
      return ""
    }

    // Convert display format (M/DD/YYYY) to ISO format (YYYY-MM-DD)
    const formatISOValue = (displayDate: string): string => {
      if (!displayDate) return ""
      
      // Try parsing different formats
      const formats = ["M/d/yyyy", "MM/dd/yyyy", "M/dd/yyyy", "MM/d/yyyy"]
      
      for (const formatString of formats) {
        try {
          const date = parse(displayDate, formatString, new Date())
          if (isValid(date)) {
            return format(date, "yyyy-MM-dd")
          }
        } catch (error) {
          continue
        }
      }
      return ""
    }

    // Update display value when prop value changes
    React.useEffect(() => {
      const newDisplayValue = formatDisplayValue(value || "")
      setDisplayValue(newDisplayValue)
    }, [value])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setDisplayValue(inputValue)
      
      if (!inputValue) {
        setIsValid_(true)
        onChange?.("")
        return
      }

      const isoValue = formatISOValue(inputValue)
      if (isoValue) {
        setIsValid_(true)
        onChange?.(isoValue)
      } else {
        setIsValid_(false)
        // Still call onChange with the raw value so the form can handle validation
        onChange?.(inputValue)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      if (inputValue) {
        const isoValue = formatISOValue(inputValue)
        if (isoValue) {
          // Reformat to consistent display format
          const reformattedDisplay = formatDisplayValue(isoValue)
          setDisplayValue(reformattedDisplay)
          setIsValid_(true)
        }
      }
    }

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          !isValid_ && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        {...props}
      />
    )
  }
)

DateInput.displayName = "DateInput"

export { DateInput }