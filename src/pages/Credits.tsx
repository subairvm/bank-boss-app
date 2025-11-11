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
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";

interface Credit {
  id: string;
  person_name: string;
  amount: number;
  type: "owe_me" | "i_owe";
  description: string;
  date: string;
}

const Credits = () => {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    person_name: "",
    amount: "",
    type: "owe_me" as "owe_me" | "i_owe",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from("credits")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setCredits((data || []) as Credit[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading credits",
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
      const { error } = await supabase.from("credits").insert({
        user_id: user.id,
        person_name: formData.person_name,
        amount: parseFloat(formData.amount),
        type: formData.type,
        description: formData.description,
        date: formData.date,
      });

      if (error) throw error;

      toast({ title: "Credit record added successfully" });
      setOpen(false);
      setFormData({
        person_name: "",
        amount: "",
        type: "owe_me",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      fetchCredits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("credits").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Credit record deleted successfully" });
      fetchCredits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting credit",
        description: error.message,
      });
    }
  };

  const totalOwedToMe = credits
    .filter((c) => c.type === "owe_me")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalIOwe = credits
    .filter((c) => c.type === "i_owe")
    .reduce((sum, c) => sum + Number(c.amount), 0);

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
            <h1 className="text-4xl font-bold text-foreground">Credits</h1>
            <p className="text-muted-foreground mt-2">Track money people owe you and money you owe</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Credit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Credit Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "owe_me" | "i_owe") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owe_me">They Owe Me</SelectItem>
                      <SelectItem value="i_owe">I Owe Them</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="person_name">Person Name</Label>
                  <Input
                    id="person_name"
                    value={formData.person_name}
                    onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                    placeholder="Enter person's name"
                    required
                  />
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Add Credit
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">People Owe Me</CardTitle>
              <UserCheck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₹{totalOwedToMe.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">I Owe People</CardTitle>
              <UserX className="h-4 w-4 text-expense-light" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense-light">₹{totalIOwe.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {credits.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No credit records yet. Add your first one to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>All Credit Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {credits.map((credit) => (
                  <div
                    key={credit.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-full p-2 ${
                          credit.type === "owe_me" ? "bg-success/10" : "bg-destructive/10"
                        }`}
                      >
                        {credit.type === "owe_me" ? (
                          <UserCheck className="h-5 w-5 text-success" />
                        ) : (
                          <UserX className="h-5 w-5 text-expense-light" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{credit.person_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(credit.date).toLocaleDateString()}
                        </p>
                        {credit.description && (
                          <p className="text-sm text-muted-foreground mt-1">{credit.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold ${
                          credit.type === "owe_me" ? "text-success" : "text-expense-light"
                        }`}
                      >
                        {credit.type === "owe_me" ? "+" : "-"}₹{Number(credit.amount).toFixed(2)}
                      </span>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(credit.id)}>
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

export default Credits;
