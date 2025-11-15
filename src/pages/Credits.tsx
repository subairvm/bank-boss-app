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
import { Plus, Trash2, UserCheck, UserX, Pencil } from "lucide-react";
import { RupeeIcon } from "@/components/RupeeIcon";

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
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
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
      if (editingCredit) {
        const { error } = await supabase
          .from("credits")
          .update({
            person_name: formData.person_name,
            amount: parseFloat(formData.amount),
            type: formData.type,
            description: formData.description,
            date: formData.date,
          })
          .eq("id", editingCredit.id);

        if (error) throw error;
        toast({ title: "Credit record updated successfully" });
      } else {
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
      }

      setOpen(false);
      setEditingCredit(null);
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

  const handleEdit = (credit: Credit) => {
    setEditingCredit(credit);
    setFormData({
      person_name: credit.person_name,
      amount: credit.amount.toString(),
      type: credit.type,
      description: credit.description,
      date: credit.date,
    });
    setOpen(true);
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

  // Calculate grand totals per person
  const personTotals = credits.reduce((acc, credit) => {
    const existingPerson = acc.find(p => p.name === credit.person_name);
    const amount = Number(credit.amount);
    
    if (existingPerson) {
      if (credit.type === "owe_me") {
        existingPerson.owedToMe += amount;
      } else {
        existingPerson.iOwe += amount;
      }
    } else {
      acc.push({
        name: credit.person_name,
        owedToMe: credit.type === "owe_me" ? amount : 0,
        iOwe: credit.type === "i_owe" ? amount : 0,
      });
    }
    return acc;
  }, [] as Array<{ name: string; owedToMe: number; iOwe: number; }>);

  // Calculate net amount for each person and sort
  const sortedPersonTotals = personTotals
    .map(p => ({ ...p, net: p.owedToMe - p.iOwe }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

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
            <p className="text-muted-foreground mt-2">Track Money People I Give and Get Me</p>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
              setEditingCredit(null);
              setFormData({
                person_name: "",
                amount: "",
                type: "owe_me",
                description: "",
                date: new Date().toISOString().split("T")[0],
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Credit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCredit ? "Edit Credit Record" : "Add Credit Record"}</DialogTitle>
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
                  {editingCredit ? "Update Credit" : "Add Credit"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Person-wise Grand Totals */}
        {sortedPersonTotals.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Grand Totals by Person</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedPersonTotals.map((person) => (
                  <div
                    key={person.name}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{person.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        {person.owedToMe > 0 && (
                          <span className="text-success flex items-center gap-1">
                            They owe: <RupeeIcon size={14} />{person.owedToMe.toFixed(2)}
                          </span>
                        )}
                        {person.iOwe > 0 && (
                          <span className="text-expense-light flex items-center gap-1">
                            I owe: <RupeeIcon size={14} />{person.iOwe.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Net</p>
                      <span
                        className={`text-lg font-bold flex items-center gap-1 ${
                          person.net > 0 ? "text-success" : person.net < 0 ? "text-expense-light" : "text-muted-foreground"
                        }`}
                      >
                        {person.net > 0 ? "+" : ""}
                        <RupeeIcon size={18} />
                        {person.net.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">People Get Me</CardTitle>
              <UserCheck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success flex items-center gap-1">
                <RupeeIcon size={20} />
                {totalOwedToMe.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">I Give People</CardTitle>
              <UserX className="h-4 w-4 text-expense-light" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense-light flex items-center gap-1">
                <RupeeIcon size={20} />
                {totalIOwe.toFixed(2)}
              </div>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-lg font-bold flex items-center gap-1 ${
                          credit.type === "owe_me" ? "text-success" : "text-expense-light"
                        }`}
                      >
                        {credit.type === "owe_me" ? "+" : "-"}
                        <RupeeIcon size={16} />
                        {Number(credit.amount).toFixed(2)}
                      </span>
                      <Button size="icon" variant="outline" onClick={() => handleEdit(credit)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
