"use client"

import { useState, useRef, useEffect } from "react"

type Tab = [string, () => void]

interface ToolbarProps {
  tabs: Tab[]
  initialActiveIndex?: number
}

export function Toolbar({ tabs, initialActiveIndex = 0 }: ToolbarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex)
  const [hoverStyle, setHoverStyle] = useState({})
  const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]) // Changed to HTMLButtonElement

  // Effect to update hover style
  useEffect(() => {
    if (hoveredIndex !== null) {
      const hoveredElement = tabRefs.current[hoveredIndex]
      if (hoveredElement) {
        const { offsetLeft, offsetWidth } = hoveredElement
        setHoverStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        })
      }
    }
  }, [hoveredIndex])

  // Effect to update active style
  useEffect(() => {
    const activeElement = tabRefs.current[activeIndex]
    if (activeElement) {
      const { offsetLeft, offsetWidth } = activeElement
      setActiveStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
      })
    }
  }, [activeIndex])

  // Effect to set initial active style on mount
  useEffect(() => {
    // Ensure the initial active index is valid
    const validInitialIndex = Math.max(0, Math.min(initialActiveIndex, tabs.length - 1));
    setActiveIndex(validInitialIndex);

    // Use requestAnimationFrame to ensure layout is calculated
    requestAnimationFrame(() => {
      const initialActiveElement = tabRefs.current[validInitialIndex]
      if (initialActiveElement) {
        const { offsetLeft, offsetWidth } = initialActiveElement
        setActiveStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        })
      } else if (tabs.length > 0 && tabRefs.current[0]) {
        // Fallback to the first element if initial index is somehow invalid after mount
         const firstElement = tabRefs.current[0];
         const { offsetLeft, offsetWidth } = firstElement;
         setActiveStyle({
           left: `${offsetLeft}px`,
           width: `${offsetWidth}px`,
         });
         setActiveIndex(0); // Reset active index to 0
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveIndex, tabs.length]) // Rerun if initial index or tabs change


  const handleTabClick = (index: number, onClick: () => void) => {
    setActiveIndex(index)
    onClick()
  }

  return (
    <div className="relative flex items-center justify-center p-0"> {/* Removed Card and outer div */}
      <div className="relative">
        {/* Hover Highlight */}
        <div
          className="absolute h-[30px] transition-all duration-300 ease-out bg-[#0e0f1114] dark:bg-[#ffffff1a] rounded-[6px] flex items-center pointer-events-none" // Added pointer-events-none
          style={{
            ...hoverStyle,
            opacity: hoveredIndex !== null ? 1 : 0,
          }}
        />

        {/* Active Indicator */}
        <div
          className="absolute bottom-[-6px] h-[2px] bg-[#0e0f11] dark:bg-white transition-all duration-300 ease-out pointer-events-none" // Added pointer-events-none
          style={activeStyle}
        />

        {/* Tabs */}
        <div className="relative flex space-x-[6px] items-center">
          {tabs.map(([label, onClick], index) => (
            <button
              type="button" // Prevent default form submission
              key={label + index} // Use label + index for a more stable key if labels aren't unique
              ref={(el: HTMLButtonElement | null) => { // Updated ref type
                tabRefs.current[index] = el;
              }}
              className={`px-3 py-2 cursor-pointer transition-colors duration-300 h-[30px] flex items-center justify-center appearance-none bg-transparent border-none ${ // Added button resets
                index === activeIndex ? "text-[#0e0e10] dark:text-white" : "text-[#0e0f1199] dark:text-[#ffffff99]"
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleTabClick(index, onClick)}
              // onKeyDown removed as native button handles Enter/Space
            >
              <span className="text-sm leading-5 whitespace-nowrap"> {/* Changed inner div to span */}
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}