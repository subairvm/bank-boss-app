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
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface Bank {
  id: string;
  name: string;
}

interface Transfer {
  id: string;
  from_bank_id: string;
  to_bank_id: string;
  amount: number;
  date: string;
  notes: string;
  from_bank: { name: string };
  to_bank: { name: string };
}

const Transfers = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    from_bank_id: "",
    to_bank_id: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: banksData, error: banksError } = await supabase.from("banks").select("id, name");
      const { data: transfersData, error: transfersError } = await supabase
        .from("transfers")
        .select(`
          *,
          from_bank:banks!transfers_from_bank_id_fkey(name),
          to_bank:banks!transfers_to_bank_id_fkey(name)
        `)
        .order("date", { ascending: false });

      if (banksError) throw banksError;
      if (transfersError) throw transfersError;

      setBanks(banksData || []);
      setTransfers(transfersData || []);
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

    if (formData.from_bank_id === formData.to_bank_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot transfer to the same account",
      });
      return;
    }

    try {
      // Insert transfer
      const { error: transferError } = await supabase.from("transfers").insert({
        user_id: user.id,
        from_bank_id: formData.from_bank_id,
        to_bank_id: formData.to_bank_id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        notes: formData.notes,
      });

      if (transferError) throw transferError;

      // Update balances
      const amount = parseFloat(formData.amount);

      // Decrease from bank
      const { data: fromBankData } = await supabase
        .from("banks")
        .select("balance")
        .eq("id", formData.from_bank_id)
        .single();

      await supabase
        .from("banks")
        .update({ balance: Number(fromBankData?.balance || 0) - amount })
        .eq("id", formData.from_bank_id);

      // Increase to bank
      const { data: toBankData } = await supabase
        .from("banks")
        .select("balance")
        .eq("id", formData.to_bank_id)
        .single();

      await supabase
        .from("banks")
        .update({ balance: Number(toBankData?.balance || 0) + amount })
        .eq("id", formData.to_bank_id);

      toast({ title: "Transfer completed successfully" });
      setOpen(false);
      setFormData({
        from_bank_id: "",
        to_bank_id: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
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

  const handleDelete = async (transfer: Transfer) => {
    try {
      // Delete transfer
      const { error: deleteError } = await supabase.from("transfers").delete().eq("id", transfer.id);

      if (deleteError) throw deleteError;

      // Restore balances
      const amount = Number(transfer.amount);

      // Restore from bank
      const { data: fromBankData } = await supabase
        .from("banks")
        .select("balance")
        .eq("id", transfer.from_bank_id)
        .single();

      await supabase
        .from("banks")
        .update({ balance: Number(fromBankData?.balance || 0) + amount })
        .eq("id", transfer.from_bank_id);

      // Restore to bank
      const { data: toBankData } = await supabase
        .from("banks")
        .select("balance")
        .eq("id", transfer.to_bank_id)
        .single();

      await supabase
        .from("banks")
        .update({ balance: Number(toBankData?.balance || 0) - amount })
        .eq("id", transfer.to_bank_id);

      toast({ title: "Transfer deleted successfully" });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting transfer",
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
            <h1 className="text-4xl font-bold text-foreground">Transfers</h1>
            <p className="text-muted-foreground mt-2">Move Money Between My Accounts</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Transfer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From Account</Label>
                  <Select
                    value={formData.from_bank_id}
                    onValueChange={(value) => setFormData({ ...formData, from_bank_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
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
                  <Label htmlFor="to">To Account</Label>
                  <Select
                    value={formData.to_bank_id}
                    onValueChange={(value) => setFormData({ ...formData, to_bank_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
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
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Transfer Funds
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {transfers.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No transfers yet. Create your first one to move money between accounts!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>All Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-full p-2 bg-chart-transfer/10">
                        <ArrowRight className="h-5 w-5 text-chart-transfer" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {transfer.from_bank.name} → {transfer.to_bank.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transfer.date).toLocaleDateString()}
                        </p>
                        {transfer.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{transfer.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-foreground">
                        ₹{Number(transfer.amount).toFixed(2)}
                      </span>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(transfer)}>
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

export default Transfers;
