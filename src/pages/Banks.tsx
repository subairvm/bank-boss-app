import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Plus, Trash2, Edit } from "lucide-react";

interface Bank {
  id: string;
  name: string;
  balance: number;
  color: string;
}

const Banks = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({ name: "", balance: "0", color: "#3b82f6" });
  const { toast } = useToast();

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase.from("banks").select("*").order("created_at");

      if (error) throw error;
      setBanks(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading banks",
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
      if (editingBank) {
        const { error } = await supabase
          .from("banks")
          .update({
            name: formData.name,
            balance: parseFloat(formData.balance),
            color: formData.color,
          })
          .eq("id", editingBank.id);

        if (error) throw error;
        toast({ title: "Bank account updated successfully" });
      } else {
        const { error } = await supabase.from("banks").insert({
          user_id: user.id,
          name: formData.name,
          balance: parseFloat(formData.balance),
          color: formData.color,
        });

        if (error) throw error;
        toast({ title: "Bank account created successfully" });
      }

      setOpen(false);
      setEditingBank(null);
      setFormData({ name: "", balance: "0", color: "#3b82f6" });
      fetchBanks();
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
      const { error } = await supabase.from("banks").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Bank account deleted successfully" });
      fetchBanks();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting bank",
        description: error.message,
      });
    }
  };

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      name: bank.name,
      balance: bank.balance.toString(),
      color: bank.color,
    });
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
    setEditingBank(null);
    setFormData({ name: "", balance: "0", color: "#3b82f6" });
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
            <h1 className="text-4xl font-bold text-foreground">Bank Accounts</h1>
            <p className="text-muted-foreground mt-2">Manage your bank accounts</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleDialogClose()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBank ? "Edit" : "Add"} Bank Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Bank Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Chase Checking"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance">Initial Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingBank ? "Update" : "Create"} Bank Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {banks.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No bank accounts yet. Create your first one to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <Card key={bank.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: bank.color }}
                      />
                      <span className="text-xl">{bank.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(bank)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(bank.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    ${Number(bank.balance).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Banks;
