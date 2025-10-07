import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';

export const SalesCSVImport = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          try {
            let imported = 0;
            let skipped = 0;

            for (const row of results.data as any[]) {
              if (!row['Receipt Number']) continue;

              // Check if sale already exists
              const existing = await db.sales
                .where('receiptNumber')
                .equals(row['Receipt Number'])
                .first();

              if (existing) {
                skipped++;
                continue;
              }

              // Parse items
              const itemsText = row['Items'] || '';
              const items = itemsText.split(', ').map((item: string) => {
                const match = item.match(/^(.+) \((\d+)\)$/);
                if (match) {
                  return {
                    name: match[1],
                    quantity: parseInt(match[2]),
                  };
                }
                return null;
              }).filter(Boolean);

              // Create sale record
              const saleId = await db.sales.add({
                receiptNumber: row['Receipt Number'],
                totalAmount: parseFloat(row['Total Amount']) || 0,
                amountPaid: parseFloat(row['Total Amount']) || 0,
                change: 0,
                paymentMethod: row['Payment Method']?.toLowerCase() || 'cash',
                cashierId: user?.id || 0,
                cashierName: row['Cashier'] || 'Unknown',
                createdAt: new Date(row['Date'] || Date.now()),
              });

              // Create sale items
              for (const item of items) {
                if (!item) continue;

                // Try to find product by name
                const product = await db.products
                  .where('name')
                  .equals(item.name)
                  .first();

                const unitPrice = product?.sellingPrice || 0;
                const subtotal = unitPrice * item.quantity;

                await db.saleItems.add({
                  saleId,
                  productId: product?.id || 0,
                  productName: item.name,
                  quantity: item.quantity,
                  price: unitPrice,
                  subtotal,
                });
              }

              imported++;
            }

            toast.success(`Imported ${imported} sales. Skipped ${skipped} duplicates.`);
            setOpen(false);
          } catch (error: any) {
            toast.error(error.message || 'Failed to import sales');
          } finally {
            setImporting(false);
          }
        },
        error: () => {
          toast.error('Failed to parse CSV file');
          setImporting(false);
        },
      });
    } catch (error) {
      toast.error('Failed to read file');
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import Sales
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Sales Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file exported from the cashier terminal. Duplicate sales (same receipt number) will be skipped.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={importing}
              className="flex-1 text-sm"
            />
          </div>
          {importing && (
            <p className="text-sm text-muted-foreground">Importing sales...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
