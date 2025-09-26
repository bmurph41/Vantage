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
      
      // Handle shorthand formats like "10325" -> "10/3/25"
      if (/^\d{5,6}$/.test(displayDate)) {
        const digits = displayDate
        let month, day, year
        
        if (digits.length === 5) {
          // Format: MDDYY (e.g., "10325" -> "10/3/25")
          month = digits.substring(0, 2)
          day = digits.substring(2, 3)
          year = digits.substring(3, 5)
        } else if (digits.length === 6) {
          // Format: MMDDYY (e.g., "103025" -> "10/30/25")
          month = digits.substring(0, 2)
          day = digits.substring(2, 4)
          year = digits.substring(4, 6)
        } else {
          return ""
        }
        
        // Convert 2-digit year to 4-digit year (assume 20xx for years 00-30, 19xx for 31-99)
        const yearNum = parseInt(year)
        const fullYear = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum
        
        const formattedDate = `${month}/${day}/${fullYear}`
        
        // Validate the constructed date
        try {
          const date = parse(formattedDate, "M/d/yyyy", new Date())
          if (isValid(date)) {
            return format(date, "yyyy-MM-dd")
          }
        } catch (error) {
          // Fall through to normal parsing
        }
      }
      
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
        // If it's a shorthand format (like "10325"), immediately format the display
        if (/^\d{5,6}$/.test(inputValue)) {
          const reformattedDisplay = formatDisplayValue(isoValue)
          setDisplayValue(reformattedDisplay)
        }
      } else {
        setIsValid_(false)
        // Don't call onChange with obviously invalid values like single characters
        // Let the form handle validation of empty/incomplete input
        if (inputValue.length > 2) {
          onChange?.(inputValue)
        }
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