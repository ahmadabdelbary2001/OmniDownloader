import * as React from "react"
import { cn } from "../../lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

const Tabs = ({ value, onValueChange, className, children }: { value: string, onValueChange: (v: string) => void, className?: string, children: React.ReactNode }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("flex flex-col", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ className, children }: { className?: string, children: React.ReactNode }) => (
  <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-slate-900/50 p-1 text-slate-500", className)}>
    {children}
  </div>
)

const TabsTrigger = ({ value, className, children }: { value: string, className?: string, children: React.ReactNode }) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsTrigger must be used within Tabs")
  
  const isActive = context.value === value
  return (
    <button
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isActive ? "bg-blue-600 text-white shadow" : "hover:text-slate-300",
        className
      )}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ value, className, children }: { value: string, className?: string, children: React.ReactNode }) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsContent must be used within Tabs")
  
  if (value !== context.value) return null
  return (
    <div className={cn("mt-2 ring-offset-background focus-visible:outline-none", className)}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
