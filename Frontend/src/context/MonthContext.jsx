import { createContext, useCallback, useContext, useState } from "react";

const MonthContext = createContext(null);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const MonthProvider = ({ children }) => {
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    const savedMonth = localStorage.getItem("monie-track-selected-month");
    return MONTH_PATTERN.test(savedMonth || "") ? savedMonth : getCurrentMonth();
  });

  const setSelectedMonth = useCallback((month) => {
    if (!MONTH_PATTERN.test(month || "")) return;
    localStorage.setItem("monie-track-selected-month", month);
    setSelectedMonthState(month);
  }, []);

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </MonthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSelectedMonth = () => useContext(MonthContext);
