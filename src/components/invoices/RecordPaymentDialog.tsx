import { useState } from 'react';
import { db, Invoice, InvoicePayment } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordPaymentDialogProps {
  invoice: Invoice;
  onClose: () => void;
  onPaymentRecorded: () => void;
}

const RecordPaymentDialog = ({ invoice, onClose, onPaymentRecorded }: RecordPaymentDialogProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [paymentMethod, setPaymentMethod] = useState<InvoicePayment['paymentMethod']>('cash');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const handleRecordPayment = async () => {
    if (amount <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }

    if (amount > invoice.balanceDue) {
      toast.error('Payment amount cannot exceed balance due');
      return;
    }

    try {
      // Record payment
      await db.invoicePayments.add({
        invoiceId: invoice.id!,
        paymentDate,
        amount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        recordedBy: user!.id!,
        createdAt: new Date()
      });

      // Update invoice
      const newAmountPaid = invoice.amountPaid + amount;
      const newBalanceDue = invoice.totalAmount - newAmountPaid;
      const newStatus = newBalanceDue === 0 ? 'paid' : invoice.status;

      await db.invoices.update(invoice.id!, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        updatedAt: new Date()
      });

      toast.success('Payment recorded successfully');
      onPaymentRecorded();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span>Invoice Total:</span>
              <span className="font-semibold">KES {invoice.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Amount Paid:</span>
              <span className="font-semibold">KES {invoice.amountPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1">
              <span className="font-semibold">Balance Due:</span>
              <span className="font-bold">KES {invoice.balanceDue.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Amount *</Label>
            <Input
              type="number"
              min="0"
              max={invoice.balanceDue}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as InvoicePayment['paymentMethod'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-PESA</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(paymentDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={paymentDate} onSelect={(date) => date && setPaymentDate(date)} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., M-PESA code, check number"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} className="flex-1">
              Record Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;
