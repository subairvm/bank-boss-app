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
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";

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
  banks: { name: string };
}

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
    notes: "",
    bank_id: "",
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
            <p className="text-muted-foreground mt-2">Track your income and expenses</p>
          </div>
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
                      setFormData({ ...formData, type: value })
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
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Salary, Groceries"
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
              <div className="space-y-4">
                {transactions.map((transaction) => (
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
                        <p className="font-semibold text-foreground">
                          {transaction.category || "Uncategorized"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.banks.name} • {new Date(transaction.date).toLocaleDateString()}
                        </p>
                        {transaction.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{transaction.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold ${
                          transaction.type === "income" ? "text-success" : "text-destructive"
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
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Transactions;
