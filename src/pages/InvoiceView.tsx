import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, Invoice, InvoiceItem, InvoicePayment } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Edit, DollarSign, X } from 'lucide-react';
import { format } from 'date-fns';
import InvoicePrintView from '@/components/invoices/InvoicePrintView';
import RecordPaymentDialog from '@/components/invoices/RecordPaymentDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const InvoiceView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoice(parseInt(id));
    }
  }, [id]);

  const loadInvoice = async (invoiceId: number) => {
    const inv = await db.invoices.get(invoiceId);
    if (!inv) {
      toast.error('Invoice not found');
      navigate('/invoices');
      return;
    }

    await db.updateInvoiceStatus(invoiceId);
    const updatedInv = await db.invoices.get(invoiceId);
    setInvoice(updatedInv!);

    const invItems = await db.invoiceItems.where('invoiceId').equals(invoiceId).toArray();
    setItems(invItems);

    const invPayments = await db.invoicePayments.where('invoiceId').equals(invoiceId).sortBy('paymentDate');
    setPayments(await invPayments);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    
    if (!confirm('Are you sure you want to cancel this invoice?')) return;

    await db.invoices.update(invoice.id!, {
      status: 'cancelled',
      updatedAt: new Date()
    });

    toast.success('Invoice cancelled');
    loadInvoice(invoice.id!);
  };

  const handlePaymentRecorded = () => {
    setShowPaymentDialog(false);
    loadInvoice(parseInt(id!));
  };

  if (!invoice) {
    return <div className="p-8">Loading...</div>;
  }

  const getStatusBadge = (status: Invoice['status']) => {
    const variants: Record<Invoice['status'], { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      sent: { variant: 'default', label: 'Sent' },
      paid: { variant: 'outline', label: 'Paid' },
      overdue: { variant: 'destructive', label: 'Overdue' },
      cancelled: { variant: 'outline', label: 'Cancelled' }
    };

    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="print:hidden p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/invoices')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{invoice.invoiceNumber}</h1>
                <p className="text-muted-foreground">{invoice.customerName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(invoice.status)}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {invoice.status === 'draft' && (
              <Button variant="outline" onClick={() => navigate(`/invoices/edit/${invoice.id}`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <Button onClick={() => setShowPaymentDialog(true)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && user?.role === 'admin' && (
              <Button variant="destructive" onClick={handleCancelInvoice}>
                <X className="h-4 w-4 mr-2" />
                Cancel Invoice
              </Button>
            )}
          </div>

          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.paymentDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                        <TableCell>{payment.referenceNumber || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <InvoicePrintView invoice={invoice} items={items} />

      {showPaymentDialog && (
        <RecordPaymentDialog
          invoice={invoice}
          onClose={() => setShowPaymentDialog(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
};

export default InvoiceView;
