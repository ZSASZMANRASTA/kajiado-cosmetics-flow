import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, Product, Invoice, InvoiceItem } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

interface LineItem {
  id: string;
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

const InvoiceCreate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 }
  ]);

  useEffect(() => {
    loadProducts();
    if (id) {
      loadInvoice(parseInt(id));
    }
  }, [id]);

  const loadProducts = async () => {
    const allProducts = await db.products.toArray();
    setProducts(allProducts);
  };

  const loadInvoice = async (invoiceId: number) => {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) return;

    setCustomerName(invoice.customerName);
    setCustomerPhone(invoice.customerPhone || '');
    setCustomerEmail(invoice.customerEmail || '');
    setCustomerAddress(invoice.customerAddress || '');
    setIssueDate(new Date(invoice.issueDate));
    setDueDate(new Date(invoice.dueDate));
    setPaymentTerms(invoice.paymentTerms);
    setNotes(invoice.notes || '');

    const items = await db.invoiceItems.where('invoiceId').equals(invoiceId).toArray();
    setLineItems(items.map((item, idx) => ({
      id: String(idx + 1),
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    })));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: String(lineItems.length + 1),
      description: '',
      quantity: 1,
      unitPrice: 0
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error('Invoice must have at least one item');
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const selectProduct = (itemId: string, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    updateLineItem(itemId, 'productId', productId);
    updateLineItem(itemId, 'description', product.name);
    updateLineItem(itemId, 'unitPrice', product.sellingPrice);
  };

  const calculateItemTotal = (item: LineItem) => {
    const subtotal = item.quantity * item.unitPrice;
    const vatAmount = subtotal * 0.16;
    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount
    };
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    const vatAmount = subtotal * 0.16;
    const total = subtotal + vatAmount;

    return { subtotal, vatAmount, total };
  };

  const saveInvoice = async (status: Invoice['status']) => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (lineItems.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
      toast.error('All line items must have description, quantity and price');
      return;
    }

    try {
      const totals = calculateTotals();
      const invoiceNumber = id ? (await db.invoices.get(parseInt(id)))!.invoiceNumber : await db.generateInvoiceNumber();

      const invoiceData: Invoice = {
        invoiceNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        issueDate,
        dueDate,
        status,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        paymentTerms,
        notes: notes.trim() || undefined,
        createdBy: user!.id!,
        createdAt: id ? (await db.invoices.get(parseInt(id)))!.createdAt : new Date(),
        updatedAt: new Date()
      };

      let invoiceId: number;
      if (id) {
        await db.invoices.update(parseInt(id), invoiceData);
        invoiceId = parseInt(id);
        await db.invoiceItems.where('invoiceId').equals(invoiceId).delete();
      } else {
        invoiceId = (await db.invoices.add(invoiceData)) as number;
      }

      for (const item of lineItems) {
        const itemTotals = calculateItemTotal(item);
        await db.invoiceItems.add({
          invoiceId,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: itemTotals.subtotal,
          vatAmount: itemTotals.vatAmount,
          total: itemTotals.total
        });
      }

      toast.success(`Invoice ${id ? 'updated' : 'created'} successfully`);
      navigate(`/invoices/${invoiceId}`);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    }
  };

  const totals = calculateTotals();

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{id ? 'Edit Invoice' : 'Create Invoice'}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Enter address"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(issueDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={issueDate} onSelect={(date) => date && setIssueDate(date)} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dueDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dueDate} onSelect={(date) => date && setDueDate(date)} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 7">Net 7 days</SelectItem>
                    <SelectItem value="Net 15">Net 15 days</SelectItem>
                    <SelectItem value="Net 30">Net 30 days</SelectItem>
                    <SelectItem value="Net 60">Net 60 days</SelectItem>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button onClick={addLineItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => {
                  const itemTotal = calculateItemTotal(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <Search className="h-4 w-4 mr-2" />
                                {item.description || 'Select product or enter custom'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <Input
                                  placeholder="Search products..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                  {filteredProducts.slice(0, 10).map(product => (
                                    <Button
                                      key={product.id}
                                      variant="ghost"
                                      className="w-full justify-start"
                                      onClick={() => {
                                        selectProduct(item.id, product.id!);
                                        setSearchTerm('');
                                      }}
                                    >
                                      {product.name} - KES {product.sellingPrice}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Or type custom description"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        KES {itemTotal.total.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">KES {totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span className="font-medium">KES {totals.vatAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>KES {totals.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes or payment instructions..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => saveInvoice('draft')}>
            Save as Draft
          </Button>
          <Button onClick={() => saveInvoice('sent')}>
            Finalize Invoice
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCreate;
