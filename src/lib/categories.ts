export const INCOME_CATEGORIES = [
  "Salary",
  "Share Trading",
  "HPK Bank",
  "Other Source",
  "Freelance",
] as const;

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Medical",
  "EMI",
  "Rent",
  "Dining",
  "Shopping",
  "Travel",
  "Donation",
  "Home Needs",
  "Other",
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type Category = IncomeCategory | ExpenseCategory;
