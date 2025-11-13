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
import { Plus, Trash2, TrendingUp, TrendingDown, Filter, X, CalendarIcon } from "lucide-react";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, getCategoryIcon } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";

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
      // Insert transaction
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: formData.type,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        notes: formData.notes,
        bank_id: formData.bank_id,
        person_name: formData.person_name || null,
      });

      if (transactionError) throw transactionError;

      // Update bank balance
      const bank = banks.find((b) => b.id === formData.bank_id);
      if (bank) {
        const { data: bankData } = await supabase
          .from("banks")
          .select("balance")
          .eq("id", formData.bank_id)
          .single();

        const currentBalance = Number(bankData?.balance || 0);
        const amount = parseFloat(formData.amount);
        const newBalance =
          formData.type === "income" ? currentBalance + amount : currentBalance - amount;

        await supabase.from("banks").update({ balance: newBalance }).eq("id", formData.bank_id);
      }

      toast({ title: "Transaction added successfully" });
      setOpen(false);
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
          <div className="flex items-center gap-3">
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
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
                  Add Transaction
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
                        className={`text-lg font-bold ${
                          transaction.type === "income" ? "text-success" : "text-expense-light"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}₹
                        {Number(transaction.amount).toFixed(2)}
                      </span>
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
