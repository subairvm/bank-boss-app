import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Download, Upload } from "lucide-react";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category: string;
}

const Reports = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
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

  const handleExport = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-export-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Data exported successfully" });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid file format");
      }

      toast({ title: "Data imported successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error importing data",
        description: error.message,
      });
    }
  };

  const calculateMonthlyReport = () => {
    const monthlyData: {
      [key: string]: { income: number; expense: number };
    } = {};

    transactions.forEach((t) => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      monthlyData[month][t.type] += Number(t.amount);
    });

    return monthlyData;
  };

  const calculateCategoryReport = () => {
    const categoryData: {
      [key: string]: { income: number; expense: number };
    } = {};

    transactions.forEach((t) => {
      const category = t.category || "Uncategorized";
      if (!categoryData[category]) {
        categoryData[category] = { income: 0, expense: 0 };
      }
      categoryData[category][t.type] += Number(t.amount);
    });

    return categoryData;
  };

  const monthlyReport = calculateMonthlyReport();
  const categoryReport = calculateCategoryReport();

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
            <h1 className="text-4xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-2">Analyze your financial data</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Import JSON
                </span>
              </Button>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Monthly Report</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(monthlyReport).length === 0 ? (
                <p className="text-muted-foreground text-sm">No data available</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(monthlyReport)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([month, data]) => (
                      <div key={month} className="space-y-2">
                        <p className="font-semibold text-foreground">
                          {new Date(month + "-01").toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                          })}
                        </p>
                        <div className="flex justify-between text-sm">
                          <span className="text-success">Income: ₹{data.income.toFixed(2)}</span>
                          <span className="text-destructive">
                            Expenses: ₹{data.expense.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          Net: ₹{(data.income - data.expense).toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Category Report</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(categoryReport).length === 0 ? (
                <p className="text-muted-foreground text-sm">No data available</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(categoryReport).map(([category, data]) => (
                    <div key={category} className="space-y-2">
                      <p className="font-semibold text-foreground">{category}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-success">Income: ₹{data.income.toFixed(2)}</span>
                        <span className="text-destructive">
                          Expenses: ₹{data.expense.toFixed(2)}
                        </span>
                      </div>
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

export default Reports;
