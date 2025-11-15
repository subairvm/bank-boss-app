import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Plus, Trash2, TrendingUp, TrendingDown, Filter, X, CalendarIcon, Download, Pencil } from "lucide-react";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, getCategoryIcon } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { RupeeIcon } from "@/components/RupeeIcon";

interface Bank {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category: string;
  notes: string;
  bank_id: string;
  person_name: string;
  banks: { name: string };
}

type DateRangePreset = "all" | "7days" | "30days" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
    notes: "",
    bank_id: "",
    person_name: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: banksData, error: banksError } = await supabase.from("banks").select("id, name");
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*, banks(name)")
        .order("date", { ascending: false });

      if (banksError) throw banksError;
      if (transactionsError) throw transactionsError;

      setBanks(banksData || []);
      setTransactions((transactionsData || []) as Transaction[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    if (!formData.category) {
      toast({
        variant: "destructive",
        title: "Category required",
        description: "Please select a category for this transaction",
      });
      return;
    }

    try {
      if (editingTransaction) {
        // Update existing transaction
        const oldAmount = Number(editingTransaction.amount);
        const newAmount = parseFloat(formData.amount);
        const oldType = editingTransaction.type;
        const newType = formData.type;

        // Update transaction
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            type: formData.type,
            amount: newAmount,
            date: formData.date,
            category: formData.category,
            notes: formData.notes,
            bank_id: formData.bank_id,
            person_name: formData.person_name,
          })
          .eq("id", editingTransaction.id);

        if (updateError) throw updateError;

        // Adjust bank balance
        const { data: bankData } = await supabase
          .from("banks")
          .select("balance")
          .eq("id", formData.bank_id)
          .single();

        let currentBalance = Number(bankData?.balance || 0);

        // Reverse old transaction effect
        if (oldType === "income") {
          currentBalance -= oldAmount;
        } else {
          currentBalance += oldAmount;
        }

        // Apply new transaction effect
        if (newType === "income") {
          currentBalance += newAmount;
        } else {
          currentBalance -= newAmount;
        }

        await supabase.from("banks").update({ balance: currentBalance }).eq("id", formData.bank_id);

        toast({ title: "Transaction updated successfully" });
      } else {
        // Insert transaction
        const { error: transactionError } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: formData.type,
          amount: parseFloat(formData.amount),
          date: formData.date,
          category: formData.category,
          notes: formData.notes,
          bank_id: formData.bank_id,
          person_name: formData.person_name,
        });

        if (transactionError) throw transactionError;

        // Update bank balance
        const { data: bankData } = await supabase
          .from("banks")
          .select("balance")
          .eq("id", formData.bank_id)
          .single();

        const currentBalance = Number(bankData?.balance || 0);
        const amount = parseFloat(formData.amount);
        const newBalance = formData.type === "income" ? currentBalance + amount : currentBalance - amount;

        await supabase.from("banks").update({ balance: newBalance }).eq("id", formData.bank_id);

        toast({ title: "Transaction added successfully" });
      }

      setOpen(false);
      setEditingTransaction(null);
      setFormData({
        type: "income",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        category: "",
        notes: "",
        bank_id: "",
        person_name: "",
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      date: transaction.date,
      category: transaction.category,
      notes: transaction.notes || "",
      bank_id: transaction.bank_id,
      person_name: transaction.person_name || "",
    });
    setOpen(true);
  };

  const handleDelete = async (transaction: Transaction) => {
    try {
      // Delete transaction
      const { error: deleteError } = await supabase.from("transactions").delete().eq("id", transaction.id);

      if (deleteError) throw deleteError;

      // Restore bank balance
      const { data: bankData } = await supabase
        .from("banks")
        .select("balance")
        .eq("id", transaction.bank_id)
        .single();

      const currentBalance = Number(bankData?.balance || 0);
      const amount = Number(transaction.amount);
      const newBalance =
        transaction.type === "income" ? currentBalance - amount : currentBalance + amount;

      await supabase.from("banks").update({ balance: newBalance }).eq("id", transaction.bank_id);

      toast({ title: "Transaction deleted successfully" });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting transaction",
        description: error.message,
      });
    }
  };

  const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  
  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const getDateRange = (): { from: Date; to: Date } | null => {
    const today = new Date();
    
    switch (dateRangePreset) {
      case "all":
        return null;
      case "7days":
        return { from: subDays(today, 7), to: today };
      case "30days":
        return { from: subDays(today, 30), to: today };
      case "thisMonth":
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case "thisYear":
        return { from: startOfYear(today), to: endOfYear(today) };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return { from: customDateRange.from, to: customDateRange.to };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    // Category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(transaction.category)) {
      return false;
    }
    
    // Date filter
    const dateRange = getDateRange();
    if (dateRange) {
      const transactionDate = new Date(transaction.date);
      if (transactionDate < dateRange.from || transactionDate > dateRange.to) {
        return false;
      }
    }
    
    return true;
  });

  const calculateCategoryTotals = () => {
    const categoryTotals: {
      [category: string]: { income: number; expense: number };
    } = {};

    filteredTransactions.forEach((transaction) => {
      const category = transaction.category || "Uncategorized";
      if (!categoryTotals[category]) {
        categoryTotals[category] = { income: 0, expense: 0 };
      }
      categoryTotals[category][transaction.type] += Number(transaction.amount);
    });

    return categoryTotals;
  };

  const categoryTotals = calculateCategoryTotals();

  const handleDatePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset);
    if (preset !== "custom") {
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  const getDateRangeLabel = (): string => {
    switch (dateRangePreset) {
      case "all":
        return "All Time";
      case "7days":
        return "Last 7 Days";
      case "30days":
        return "Last 30 Days";
      case "thisMonth":
        return "This Month";
      case "lastMonth":
        return "Last Month";
      case "thisYear":
        return "This Year";
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d, yyyy")}`;
        }
        return "Custom Range";
      default:
        return "All Time";
    }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no transactions to export with the current filters.",
      });
      return;
    }

    // CSV Headers
    const headers = ["Date", "Type", "Category", "Amount (₹)", "Bank", "Person", "Notes"];
    
    // Convert transactions to CSV rows
    const rows = filteredTransactions.map((transaction) => {
      return [
        new Date(transaction.date).toLocaleDateString(),
        transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
        transaction.category || "Uncategorized",
        Number(transaction.amount).toFixed(2),
        transaction.banks.name,
        transaction.person_name || "",
        (transaction.notes || "").replace(/"/g, '""'), // Escape quotes
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
    const filename = `transactions_${timestamp}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${filteredTransactions.length} transactions to ${filename}`,
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-2">Track My Income and Expenses</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {getDateRangeLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quick Ranges</Label>
                    <div className="grid gap-2">
                      {[
                        { value: "all", label: "All Time" },
                        { value: "7days", label: "Last 7 Days" },
                        { value: "30days", label: "Last 30 Days" },
                        { value: "thisMonth", label: "This Month" },
                        { value: "lastMonth", label: "Last Month" },
                        { value: "thisYear", label: "This Year" },
                      ].map((preset) => (
                        <Button
                          key={preset.value}
                          variant={dateRangePreset === preset.value ? "default" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => handleDatePresetChange(preset.value as DateRangePreset)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Range</Label>
                    <Calendar
                      mode="range"
                      selected={{ from: customDateRange.from, to: customDateRange.to }}
                      onSelect={(range) => {
                        setCustomDateRange({ from: range?.from, to: range?.to });
                        if (range?.from && range?.to) {
                          setDateRangePreset("custom");
                        }
                      }}
                      numberOfMonths={2}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Categories
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search categories..." />
                  <CommandList>
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandGroup>
                      {allCategories.map((category) => {
                        const Icon = category.icon;
                        const isSelected = selectedCategories.includes(category.name);
                        return (
                          <CommandItem
                            key={category.name}
                            onSelect={() => toggleCategory(category.name)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox checked={isSelected} />
                            <Icon className="h-4 w-4" />
                            <span>{category.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                  {selectedCategories.length > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCategories([])}
                        className="w-full"
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setEditingTransaction(null);
                setFormData({
                  type: "income",
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                  category: "",
                  notes: "",
                  bank_id: "",
                  person_name: "",
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTransaction ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "income" | "expense") =>
                      setFormData({ ...formData, type: value, category: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank Account</Label>
                  <Select
                    value={formData.bank_id}
                    onValueChange={(value) => setFormData({ ...formData, bank_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                        (category) => {
                          const Icon = category.icon;
                          return (
                            <SelectItem key={category.name} value={category.name}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          );
                        }
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="person_name">Person Name (Optional)</Label>
                  <Input
                    id="person_name"
                    value={formData.person_name}
                    onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingTransaction ? "Update Transaction" : "Add Transaction"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((category) => {
              const Icon = getCategoryIcon(category);
              return (
                <Badge key={category} variant="secondary" className="gap-1 pr-1">
                  <Icon className="h-3 w-3" />
                  {category}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => toggleCategory(category)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}

        {filteredTransactions.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Category Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(categoryTotals)
                  .sort((a, b) => {
                    const totalA = a[1].income + a[1].expense;
                    const totalB = b[1].income + b[1].expense;
                    return totalB - totalA;
                  })
                  .map(([category, totals]) => {
                    const CategoryIcon = getCategoryIcon(category);
                    const net = totals.income - totals.expense;
                    return (
                      <div
                        key={category}
                        className="p-4 border border-border rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          <p className="font-semibold text-foreground">{category}</p>
                        </div>
                        {totals.income > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Income:</span>
                            <span className="text-success font-medium flex items-center gap-1">
                              <RupeeIcon size={14} />
                              {totals.income.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {totals.expense > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Expenses:</span>
                            <span className="text-destructive font-medium flex items-center gap-1">
                              <RupeeIcon size={14} />
                              {totals.expense.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
                          <span className="text-muted-foreground">Net:</span>
                          <span className={`flex items-center gap-1 ${net >= 0 ? "text-success" : "text-destructive"}`}>
                            <RupeeIcon size={14} />
                            {net.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {transactions.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No transactions yet. Add your first one to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions match the selected categories.
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-full p-2 ${
                          transaction.type === "income" ? "bg-success/10" : "bg-destructive/10"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <TrendingUp className="h-5 w-5 text-success" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {transaction.category && (() => {
                            const CategoryIcon = getCategoryIcon(transaction.category);
                            return <CategoryIcon className="h-4 w-4 text-muted-foreground" />;
                          })()}
                          <p className="font-semibold text-foreground">
                            {transaction.category || "Uncategorized"}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {transaction.banks.name} • {new Date(transaction.date).toLocaleDateString()}
                          {transaction.person_name && ` • ${transaction.person_name}`}
                        </p>
                        {transaction.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{transaction.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold flex items-center gap-1 ${
                          transaction.type === "income" ? "text-success" : "text-expense-light"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        <RupeeIcon size={16} />
                        {Number(transaction.amount).toFixed(2)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(transaction)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Transactions;
