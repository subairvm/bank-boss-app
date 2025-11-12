import { 
  Wallet, 
  TrendingUp, 
  Landmark, 
  PlusCircle, 
  Briefcase,
  Fuel,
  Activity,
  CreditCard,
  Home,
  Utensils,
  ShoppingBag,
  Plane,
  Gift,
  Package,
  MoreHorizontal,
  LucideIcon
} from "lucide-react";

export interface CategoryItem {
  name: string;
  icon: LucideIcon;
}

export const INCOME_CATEGORIES: CategoryItem[] = [
  { name: "Salary", icon: Wallet },
  { name: "Share Trading", icon: TrendingUp },
  { name: "HPK Bank", icon: Landmark },
  { name: "Other Source", icon: PlusCircle },
  { name: "Freelance", icon: Briefcase },
];

export const EXPENSE_CATEGORIES: CategoryItem[] = [
  { name: "Fuel", icon: Fuel },
  { name: "Medical", icon: Activity },
  { name: "EMI", icon: CreditCard },
  { name: "Rent", icon: Home },
  { name: "Dining", icon: Utensils },
  { name: "Shopping", icon: ShoppingBag },
  { name: "Travel", icon: Plane },
  { name: "Donation", icon: Gift },
  { name: "Home Needs", icon: Package },
  { name: "Other", icon: MoreHorizontal },
];

export type IncomeCategory = typeof INCOME_CATEGORIES[number]["name"];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]["name"];
export type Category = IncomeCategory | ExpenseCategory;

export const getCategoryIcon = (categoryName: string): LucideIcon => {
  const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  const category = allCategories.find(cat => cat.name === categoryName);
  return category?.icon || MoreHorizontal;
};
