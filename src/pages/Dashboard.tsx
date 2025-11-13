import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";

interface Bank {
  id: string;
  name: string;
  balance: number;
  color: string;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  person_name: string;
}

const Dashboard = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: banksData, error: banksError } = await supabase
        .from("banks")
        .select("*")
        .order("created_at", { ascending: true });

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
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

  const totalBalance = banks.reduce((sum, bank) => sum + Number(bank.balance), 0);
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const statCards = [
    {
      title: "Total Balance",
      value: totalBalance,
      icon: Wallet,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Income",
      value: totalIncome,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Total Expenses",
      value: totalExpenses,
      icon: TrendingDown,
      color: "text-expense-light",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Net Income",
      value: totalIncome - totalExpenses,
      icon: IndianRupee,
      color: totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive",
      bgColor:
        totalIncome - totalExpenses >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
  ];

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
        <div>
          <h1 className="text-4xl font-bold text-foreground">Subair V M</h1>
          <p className="text-muted-foreground mt-2">Overview of My Finances</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-full p-2 ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    ₹{stat.value.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Bank Accounts ({banks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {banks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bank accounts yet</p>
              ) : (
                <div className="space-y-3">
                  {banks.slice(0, 5).map((bank) => (
                    <div key={bank.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: bank.color }}
                        />
                        <span className="font-medium text-foreground">{bank.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        <span className="text-success">₹{Number(bank.balance).toFixed(2)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No transactions yet</p>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {transaction.type === "income" ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-expense-light" />
                        )}
                        <div>
                          <span className="text-sm text-foreground">
                            {new Date(transaction.date).toLocaleDateString()}
                          </span>
                          {transaction.person_name && (
                            <p className="text-xs text-muted-foreground">{transaction.person_name}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          transaction.type === "income" ? "text-success" : "text-expense-light"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}₹
                        {Number(transaction.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
